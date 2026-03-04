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

export type Turn = UserTurn | AssistantTurn;

/**
 * Groups flat messages[] and toolCalls[] into ordered Turn[] array.
 *
 * Algorithm:
 * 1. Index tool calls by messageId, identifying orphans
 * 2. Sort messages by createdAt
 * 3. Walk messages: user -> UserTurn, assistant -> AssistantTurn with linked tool calls
 * 4. Sort tool calls within each turn by createdAt
 * 5. Attach orphans to nearest preceding assistant turn by timestamp
 *
 * Pure function -- no Vue reactivity dependency.
 */
export function groupTurns(messages: MessageRow[], toolCalls: ToolCallRow[]): Turn[] {
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

  // 3. Build turns
  const turns: Turn[] = [];
  for (const msg of sorted) {
    if (msg.role === 'user') {
      turns.push({ type: 'user', message: msg });
    } else {
      const tcs = tcByMsg.get(msg.id) || [];
      tcs.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      turns.push({ type: 'assistant', message: msg, toolCalls: tcs });
    }
  }

  // 4. Attach orphans to nearest preceding assistant turn by timestamp
  for (const orphan of orphans) {
    const orphanTime = new Date(orphan.createdAt).getTime();
    let bestTurn: AssistantTurn | null = null;

    for (const turn of turns) {
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
    // If no preceding assistant turn, orphan is dropped
  }

  return turns;
}
