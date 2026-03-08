import Database from 'better-sqlite3';

// ── Types ──────────────────────────────────────────────────────────────

export interface CursorConversation {
  composerId: string;
  name: string | null;
  createdAt: number;      // ms timestamp
  lastUpdatedAt: number;  // ms timestamp
  status: string | null;
  isAgentic: boolean;
  usageData: Record<string, { costInCents: number; amount: number }> | null;
  modelConfig: { modelName?: string } | null;
  fullConversationHeadersOnly: Array<{ bubbleId: string; type: number }>;
  workspacePath: string | null;
}

export interface CursorBubble {
  bubbleId: string;
  type: number;           // 1 = user, 2 = AI
  text: string;
  createdAt: string | null;
  tokenCount: { inputTokens: number; outputTokens: number } | null;
  modelInfo: { modelName?: string } | null;
  timingInfo: { clientStartTime?: number; clientEndTime?: number } | null;
  toolFormerData?: {
    name?: string;
    status?: string;
    params?: string;
    result?: string;
    rawArgs?: string;
    toolCallId?: string;
    additionalData?: Record<string, unknown>;
  } | null;
  isCapabilityIteration: boolean;   // true when bubble is a tool/capability call
  capabilityType: number | null;    // numeric type of the capability used
  tokenCountUpUntilHere: number | null; // cumulative token count up to this bubble
  thinking: { text: string; signature?: string } | null; // thinking content from capabilityType=30 bubbles
}

// ── Parser functions ────────────────────────────────────────────────────

/**
 * Parse Cursor state.vscdb for conversation metadata.
 * Opens the database readonly to avoid corrupting Cursor's active database.
 *
 * Queries cursorDiskKV for composerData:* entries which contain
 * conversation-level metadata (name, timestamps, model config, usage data).
 */
export function parseCursorDb(dbPath: string): CursorConversation[] {
  const db = new Database(dbPath, { readonly: true, fileMustExist: true });
  const conversations: CursorConversation[] = [];

  try {
    const rows = db.prepare(
      "SELECT key, CAST(value AS TEXT) as value FROM cursorDiskKV WHERE key LIKE 'composerData:%' AND LENGTH(value) > 100"
    ).all() as Array<{ key: string; value: string }>;

    for (const row of rows) {
      try {
        const data = JSON.parse(row.value);
        const composerId = row.key.replace('composerData:', '');

        conversations.push({
          composerId,
          name: data?.name ?? null,
          createdAt: data?.createdAt || Date.now(),
          lastUpdatedAt: data?.lastUpdatedAt || data?.createdAt || Date.now(),
          status: data?.status ?? null,
          isAgentic: data?.isAgentic ?? false,
          usageData: data?.usageData ?? null,
          modelConfig: data?.modelConfig ?? null,
          fullConversationHeadersOnly: data?.fullConversationHeadersOnly ?? [],
          workspacePath: data?.workspacePath ?? data?.workspaceFolder ?? data?.rootDir ?? data?.context?.workspacePath ?? null,
        });
      } catch {
        // Skip rows with invalid JSON
      }
    }
  } finally {
    db.close();
  }

  return conversations;
}

/**
 * Get all bubbles (messages) for a specific Cursor conversation.
 * Bubbles are ordered by rowid (insertion order) which preserves chronological order.
 *
 * Each bubble has: type (1=user, 2=AI), text content, token counts,
 * model info, and timing data.
 */
export function getBubblesForConversation(dbPath: string, composerId: string): CursorBubble[] {
  const db = new Database(dbPath, { readonly: true, fileMustExist: true });
  const bubbles: CursorBubble[] = [];

  try {
    const rows = db.prepare(
      "SELECT key, CAST(value AS TEXT) as value FROM cursorDiskKV WHERE key LIKE ? ORDER BY rowid ASC"
    ).all(`bubbleId:${composerId}:%`) as Array<{ key: string; value: string }>;

    for (const row of rows) {
      try {
        const data = JSON.parse(row.value);
        // Extract bubbleId from key pattern: bubbleId:{composerId}:{bubbleId}
        const keyParts = row.key.split(':');
        const bubbleId = keyParts[keyParts.length - 1];

        bubbles.push({
          bubbleId,
          type: data?.type ?? 0,
          text: data?.text ?? '',
          createdAt: data?.createdAt ?? null,
          tokenCount: data?.tokenCount ?? null,
          modelInfo: data?.modelInfo ?? null,
          timingInfo: data?.timingInfo ?? null,
          toolFormerData: data?.toolFormerData ?? null,
          isCapabilityIteration: data?.isCapabilityIteration ?? false,
          capabilityType: data?.capabilityType ?? null,
          tokenCountUpUntilHere: data?.tokenCountUpUntilHere ?? null,
          thinking: data?.thinking ?? null,
        });
      } catch {
        // Skip rows with invalid JSON
      }
    }
  } finally {
    db.close();
  }

  return bubbles;
}
