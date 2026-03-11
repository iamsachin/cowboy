import type { MessageRow, ToolCallRow, CompactionEvent } from '../types';
import {
  isSystemInjected,
  isSlashCommand,
  isClearCommand,
  extractCommandText,
} from '../utils/content-sanitizer';

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

/** Category label for a system-injected message. */
export type SystemMessageCategory =
  | 'system-reminder'
  | 'skill-instruction'
  | 'objective'
  | 'system-caveat'
  | 'task-notification'
  | 'interrupt'
  | 'other';

/** One or more consecutive system-injected user messages collapsed into a single indicator. */
export interface SystemGroup {
  type: 'system-group';
  messages: MessageRow[];
  categories: SystemMessageCategory[];
  count: number;
}

/** A user-initiated slash command (e.g. /gsd:execute-phase 11). */
export interface SlashCommandTurn {
  type: 'slash-command';
  message: MessageRow;
  commandText: string;
}

/** A /clear command — rendered as a full-width context-reset divider. */
export interface ClearDividerTurn {
  type: 'clear-divider';
  message: MessageRow;
}

/** A user-role message that is actually a prompt sent to a subagent (via Agent/Task tool). */
export interface AgentPromptTurn {
  type: 'agent-prompt';
  message: MessageRow;
  /** Short description from the Agent tool call input, if available */
  description: string | null;
}

/** A compaction boundary — context was summarized to free token space. */
export interface CompactionTurn {
  type: 'compaction';
  id: string;
  timestamp: string;
  summary: string | null;
  tokensBefore: number | null;
  tokensAfter: number | null;
}

export type Turn = UserTurn | AssistantTurn;
export type GroupedTurn =
  | UserTurn
  | AssistantGroup
  | SystemGroup
  | SlashCommandTurn
  | ClearDividerTurn
  | AgentPromptTurn
  | CompactionTurn;

/**
 * Classify a system-injected message by examining its content.
 *
 * Priority:
 * 1. Contains `<system-reminder` → 'system-reminder'
 * 2. Contains `<objective>` or `<execution_context>` → 'objective'
 * 3. Contains `<context>` with `<files_to_read>` or `<process>` → 'skill-instruction'
 * 4. Contains `Caveat:` → 'system-caveat'
 * 5. Otherwise → 'other'
 */
export function classifySystemMessage(content: string): SystemMessageCategory {
  if (/<system-reminder/.test(content)) return 'system-reminder';
  if (/<objective>/.test(content) || /<execution_context>/.test(content)) return 'objective';
  if (/<context>/.test(content) && (/<files_to_read>/.test(content) || /<process>/.test(content))) {
    return 'skill-instruction';
  }
  if (/Caveat:/.test(content)) return 'system-caveat';
  if (/<task-notification/.test(content)) return 'task-notification';
  if (/^\[Request interrupted by user/.test(content)) return 'interrupt';
  return 'other';
}

/**
 * Groups flat messages[] and toolCalls[] into ordered GroupedTurn[] array.
 *
 * Algorithm:
 * 1. Index tool calls by messageId, identifying orphans
 * 2. Sort messages by createdAt
 * 3. Walk messages: classify user messages into UserTurn / SlashCommandTurn /
 *    ClearDividerTurn / SystemGroup; group assistant messages into AssistantGroup
 * 4. Sort tool calls within each turn by createdAt
 * 5. Attach orphans to nearest preceding assistant turn by timestamp
 * 6. Merge consecutive assistant turns into AssistantGroup
 * 7. Merge consecutive system-injected messages into SystemGroup
 *
 * Pure function -- no Vue reactivity dependency.
 */
export function groupTurns(messages: MessageRow[], toolCalls: ToolCallRow[], compactionEvents?: CompactionEvent[]): GroupedTurn[] {
  if (messages.length === 0 && toolCalls.length === 0) return [];

  // 0. Build a set of agent prompt strings from Agent/Task tool calls
  const agentPrompts = new Map<string, string | null>(); // prompt content → description
  for (const tc of toolCalls) {
    if (tc.name === 'Agent' || tc.name === 'Task') {
      const input = tc.input as Record<string, unknown> | null;
      if (input && typeof input.prompt === 'string' && input.prompt.trim()) {
        agentPrompts.set(input.prompt.trim(), typeof input.description === 'string' ? input.description : null);
      }
    }
  }

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

  // 3. Build flat turns (include only assistant turns — user turns handled below)
  const flatTurns: Turn[] = [];
  for (const msg of sorted) {
    if (msg.role === 'user') {
      // Placeholder so orphan attachment still works against assistant turns
      // User-role messages are handled in the grouping pass below
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

  // Build an indexed map of assistant turns for the grouping pass
  const assistantTurnByMsgId = new Map<string, AssistantTurn>();
  for (const turn of flatTurns) {
    if (turn.type === 'assistant') {
      assistantTurnByMsgId.set(turn.message.id, turn);
    }
  }

  // 5. Walk sorted messages and produce GroupedTurns
  const grouped: GroupedTurn[] = [];
  let pendingAssistant: AssistantTurn[] = [];
  let pendingSystem: MessageRow[] = [];
  let pendingAgentPrompts: { message: MessageRow; description: string | null }[] = [];

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

  function flushSystem(): void {
    if (pendingSystem.length === 0) return;
    const msgs = pendingSystem;
    const categories: SystemMessageCategory[] = msgs.map(m =>
      classifySystemMessage(m.content || '')
    );
    grouped.push({
      type: 'system-group',
      messages: msgs,
      categories,
      count: msgs.length,
    });
    pendingSystem = [];
  }

  function flushAgentPrompts(): void {
    if (pendingAgentPrompts.length === 0) return;
    for (const ap of pendingAgentPrompts) {
      grouped.push({ type: 'agent-prompt', message: ap.message, description: ap.description });
    }
    pendingAgentPrompts = [];
  }

  for (const msg of sorted) {
    if (msg.role === 'user') {
      const content = msg.content;

      // Check for /clear first
      if (isClearCommand(content)) {
        flushAssistant();
        flushAgentPrompts();
        flushSystem();
        grouped.push({ type: 'clear-divider', message: msg });
        continue;
      }

      // Check for other slash commands
      if (isSlashCommand(content)) {
        flushAssistant();
        flushAgentPrompts();
        flushSystem();
        grouped.push({
          type: 'slash-command',
          message: msg,
          commandText: extractCommandText(content || ''),
        });
        continue;
      }

      // Skip tool-result-only messages (no user-visible content)
      if (!content || !content.trim()) {
        continue;
      }

      // Check for agent/subagent prompts (Agent/Task tool call prompts replayed as user messages)
      const agentDesc = agentPrompts.get(content.trim());
      if (agentDesc !== undefined) {
        // Don't flush assistant group — agent prompts appear between assistant turns
        // just like system messages. Defer and flush after the group ends.
        pendingAgentPrompts.push({ message: msg, description: agentDesc });
        continue;
      }

      // Check for system-injected content
      // Do NOT flush assistant group here — system messages between assistant turns
      // should not break the group (CONV-01). They accumulate in pendingSystem and
      // flush after the assistant group ends (CONV-06).
      if (isSystemInjected(content)) {
        pendingSystem.push(msg);
        continue;
      }

      // Regular user message
      flushAssistant();
      flushAgentPrompts();
      flushSystem();
      grouped.push({ type: 'user', message: msg });
    } else {
      // Assistant message
      // Only flush system/agent-prompt messages if there's no pending assistant group.
      // If there IS a pending assistant group, they stay deferred and flush after the group ends.
      if (pendingAssistant.length === 0) {
        flushAgentPrompts();
        flushSystem();
      }
      const turn = assistantTurnByMsgId.get(msg.id);
      if (turn) {
        pendingAssistant.push(turn);
      }
    }
  }

  flushAssistant();
  flushAgentPrompts();
  flushSystem();

  // Inject compaction events at correct chronological positions
  if (compactionEvents && compactionEvents.length > 0) {
    const sortedCompactions = [...compactionEvents].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    // Helper: get the latest timestamp from a grouped turn
    function getLastTimestamp(turn: GroupedTurn): string {
      switch (turn.type) {
        case 'assistant-group':
          return turn.lastTimestamp;
        case 'user':
        case 'slash-command':
        case 'clear-divider':
        case 'agent-prompt':
          return turn.message.createdAt;
        case 'system-group':
          return turn.messages[turn.messages.length - 1].createdAt;
        case 'compaction':
          return turn.timestamp;
      }
    }

    // Insert each compaction event after the last turn whose timestamp <= compaction timestamp
    for (const ce of sortedCompactions) {
      const ceTime = new Date(ce.timestamp).getTime();
      const compactionTurn: CompactionTurn = {
        type: 'compaction',
        id: ce.id,
        timestamp: ce.timestamp,
        summary: ce.summary,
        tokensBefore: ce.tokensBefore,
        tokensAfter: ce.tokensAfter,
      };

      // Find insertion index: after the last turn whose timestamp <= ceTime
      let insertIdx = 0;
      for (let i = 0; i < grouped.length; i++) {
        const turnTime = new Date(getLastTimestamp(grouped[i])).getTime();
        if (turnTime <= ceTime) {
          insertIdx = i + 1;
        }
      }
      grouped.splice(insertIdx, 0, compactionTurn);
    }
  }

  return grouped;
}
