import type { MessageRow, ToolCallRow } from '@cowboy/shared';

export interface UserTurn {
  type: 'user';
  message: MessageRow;
}

export interface AssistantTurn {
  type: 'assistant';
  message: MessageRow;
  toolCalls: ToolCallRow[];
}

/** Multiple consecutive assistant turns grouped into one collapsible block. */
export interface AssistantGroup {
  type: 'assistant-group';
  turns: AssistantTurn[];
  model: string | null;
  messageCount: number;
  toolCallCount: number;
  firstTimestamp: string;
  lastTimestamp: string;
}

export type Turn = UserTurn | AssistantTurn;
export type GroupedTurn = UserTurn | AssistantGroup;

/**
 * Groups flat messages[] and toolCalls[] into ordered Turn[] array,
 * then merges consecutive assistant turns into AssistantGroup blocks.
 *
 * Algorithm:
 * 1. Index tool calls by messageId, identifying orphans
 * 2. Sort messages by createdAt
 * 3. Walk messages: user -> UserTurn, assistant -> AssistantTurn with linked tool calls
 * 4. Sort tool calls within each turn by createdAt
 * 5. Attach orphans to nearest preceding assistant turn by timestamp
 * 6. Merge consecutive assistant turns into AssistantGroup
 *
 * Pure function -- no Vue reactivity dependency.
 */
export function groupTurns(messages: MessageRow[], toolCalls: ToolCallRow[]): GroupedTurn[] {
  if (messages.length === 0 && toolCalls.length === 0) return [];

  // 1. Index tool calls by messageId
  const messageIds = new Set(messages.map(m => m.id));
  const tcByMsg = new Map<string, ToolCallRow[]>();
  const orphans: ToolCallRow[] = [];

  for (const tc of toolCalls) {
    if (messageIds.has(tc.messageId)) {
      const list = tcByMsg.get(tc.messageId);
      if (list) {
        list.push(tc);
      } else {
        tcByMsg.set(tc.messageId, [tc]);
      }
    } else {
      orphans.push(tc);
    }
  }

  // 2. Sort messages by createdAt
  const sorted = [...messages].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  // 3. Build flat turns
  const flatTurns: Turn[] = [];
  for (const msg of sorted) {
    if (msg.role === 'user') {
      flatTurns.push({ type: 'user', message: msg });
    } else {
      const tcs = tcByMsg.get(msg.id) || [];
      tcs.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      flatTurns.push({ type: 'assistant', message: msg, toolCalls: tcs });
    }
  }

  // 4. Attach orphans to nearest preceding assistant turn by timestamp
  for (const orphan of orphans) {
    const orphanTime = new Date(orphan.createdAt).getTime();
    let bestTurn: AssistantTurn | null = null;

    for (const turn of flatTurns) {
      if (turn.type === 'assistant') {
        const turnTime = new Date(turn.message.createdAt).getTime();
        if (turnTime <= orphanTime) {
          bestTurn = turn;
        }
      }
    }

    if (bestTurn) {
      bestTurn.toolCalls.push(orphan);
      bestTurn.toolCalls.sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
    }
  }

  // 5. Merge consecutive assistant turns into groups
  const grouped: GroupedTurn[] = [];
  let pendingAssistant: AssistantTurn[] = [];

  function flushAssistant(): void {
    if (pendingAssistant.length === 0) return;
    const turns = pendingAssistant;
    const totalToolCalls = turns.reduce((sum, t) => sum + t.toolCalls.length, 0);
    const model = turns.find(t => t.message.model)?.message.model || null;
    grouped.push({
      type: 'assistant-group',
      turns,
      model,
      messageCount: turns.length,
      toolCallCount: totalToolCalls,
      firstTimestamp: turns[0].message.createdAt,
      lastTimestamp: turns[turns.length - 1].message.createdAt,
    });
    pendingAssistant = [];
  }

  for (const turn of flatTurns) {
    if (turn.type === 'user') {
      flushAssistant();
      grouped.push(turn);
    } else {
      pendingAssistant.push(turn);
    }
  }
  flushAssistant();

  return grouped;
}
