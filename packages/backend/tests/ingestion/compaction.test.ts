import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { parseJsonlFile } from '../../src/ingestion/claude-code-parser.js';
import { stripCompactionPreamble, computeTokenDelta } from '../../src/ingestion/compaction-utils.js';
import type { AssistantMessageData } from '../../src/ingestion/claude-code-parser.js';

// ── Inline JSONL fixtures ────────────────────────────────────────────

const COMPACTION_JSONL = [
  // Normal user message
  JSON.stringify({
    type: 'user',
    uuid: 'uuid-1',
    sessionId: 'sess-1',
    timestamp: '2026-03-01T10:00:00Z',
    message: { role: 'user', content: 'Hello, help me with my code' },
  }),
  // Assistant response with usage
  JSON.stringify({
    type: 'assistant',
    uuid: 'uuid-2',
    sessionId: 'sess-1',
    timestamp: '2026-03-01T10:01:00Z',
    message: {
      role: 'assistant',
      id: 'msg-1',
      model: 'claude-sonnet-4-20250514',
      content: [{ type: 'text', text: 'Sure, I can help.' }],
      usage: { input_tokens: 100000, output_tokens: 5000, cache_read_input_tokens: 50000, cache_creation_input_tokens: 17000 },
      stop_reason: 'end_turn',
    },
  }),
  // Compaction user message with isCompactSummary: true
  JSON.stringify({
    type: 'user',
    uuid: 'uuid-3',
    sessionId: 'sess-1',
    timestamp: '2026-03-01T10:05:00Z',
    isCompactSummary: true,
    message: {
      role: 'user',
      content: 'This session is being continued from a previous conversation that ran out of context.\n\nHere is a summary of what was accomplished:\n\n- Built the auth module\n- Added JWT refresh tokens',
    },
  }),
  // Assistant response after compaction with usage
  JSON.stringify({
    type: 'assistant',
    uuid: 'uuid-4',
    sessionId: 'sess-1',
    timestamp: '2026-03-01T10:06:00Z',
    message: {
      role: 'assistant',
      id: 'msg-2',
      model: 'claude-sonnet-4-20250514',
      content: [{ type: 'text', text: 'Continuing from where we left off.' }],
      usage: { input_tokens: 30000, output_tokens: 3000, cache_read_input_tokens: 5000, cache_creation_input_tokens: 2000 },
      stop_reason: 'end_turn',
    },
  }),
].join('\n');

const NORMAL_JSONL = [
  JSON.stringify({
    type: 'user',
    uuid: 'uuid-10',
    sessionId: 'sess-2',
    timestamp: '2026-03-01T12:00:00Z',
    message: { role: 'user', content: 'Normal question' },
  }),
  JSON.stringify({
    type: 'assistant',
    uuid: 'uuid-11',
    sessionId: 'sess-2',
    timestamp: '2026-03-01T12:01:00Z',
    message: {
      role: 'assistant',
      id: 'msg-10',
      model: 'claude-sonnet-4-20250514',
      content: [{ type: 'text', text: 'Normal answer.' }],
      usage: { input_tokens: 500, output_tokens: 100 },
      stop_reason: 'end_turn',
    },
  }),
].join('\n');

// ── Test setup ───────────────────────────────────────────────────────

const TMP_DIR = join(process.cwd(), 'tests', 'ingestion', '_tmp_compaction');

beforeAll(() => {
  mkdirSync(TMP_DIR, { recursive: true });
  writeFileSync(join(TMP_DIR, 'compaction.jsonl'), COMPACTION_JSONL);
  writeFileSync(join(TMP_DIR, 'normal.jsonl'), NORMAL_JSONL);
});

afterAll(() => {
  rmSync(TMP_DIR, { recursive: true, force: true });
});

// ── Parser detection tests ───────────────────────────────────────────

describe('parseJsonlFile compaction detection', () => {
  it('returns compactionEvents when isCompactSummary: true is present', async () => {
    const result = await parseJsonlFile(join(TMP_DIR, 'compaction.jsonl'));
    expect(result.compactionEvents).toBeDefined();
    expect(result.compactionEvents).toHaveLength(1);

    const event = result.compactionEvents[0];
    expect(event.uuid).toBe('uuid-3');
    expect(event.timestamp).toBe('2026-03-01T10:05:00Z');
    expect(event.summary).toContain('Built the auth module');
  });

  it('returns empty compactionEvents for normal JSONL', async () => {
    const result = await parseJsonlFile(join(TMP_DIR, 'normal.jsonl'));
    expect(result.compactionEvents).toBeDefined();
    expect(result.compactionEvents).toHaveLength(0);
  });

  it('still processes compaction line as a user message', async () => {
    const result = await parseJsonlFile(join(TMP_DIR, 'compaction.jsonl'));
    // The compaction user message should also appear in userMessages
    const compactionUser = result.userMessages.find(m => m.uuid === 'uuid-3');
    expect(compactionUser).toBeDefined();
    expect(compactionUser!.content).toContain('This session is being continued');
  });
});

// ── Preamble stripping tests ─────────────────────────────────────────

describe('stripCompactionPreamble', () => {
  it('removes the standard preamble prefix', () => {
    const input =
      'This session is being continued from a previous conversation that ran out of context.\n\nHere is a summary:\n\n- Item 1\n- Item 2';
    const result = stripCompactionPreamble(input);
    expect(result).toBe('Here is a summary:\n\n- Item 1\n- Item 2');
  });

  it('returns full text when preamble pattern is not found', () => {
    const input = 'Just a normal summary without preamble.';
    const result = stripCompactionPreamble(input);
    expect(result).toBe('Just a normal summary without preamble.');
  });

  it('handles preamble with varying continuation text', () => {
    const input =
      'This session is being continued from a previous conversation. The assistant should pick up where it left off.\n\nKey progress:\n- Done A';
    const result = stripCompactionPreamble(input);
    expect(result).toBe('Key progress:\n- Done A');
  });
});

// ── Token delta computation tests ────────────────────────────────────

describe('computeTokenDelta', () => {
  const makeAssistant = (
    ts: string,
    usage: { input_tokens: number; output_tokens: number; cache_read_input_tokens?: number; cache_creation_input_tokens?: number } | null,
  ): AssistantMessageData => ({
    firstUuid: `uuid-${ts}`,
    messageId: `msg-${ts}`,
    timestamp: ts,
    model: 'claude-sonnet-4-20250514',
    contentBlocks: [],
    toolUseBlocks: [],
    usage,
    stopReason: 'end_turn',
  });

  it('returns correct before/after from surrounding assistant messages', () => {
    const assistants = [
      makeAssistant('2026-03-01T10:01:00Z', { input_tokens: 100000, output_tokens: 5000, cache_read_input_tokens: 50000, cache_creation_input_tokens: 17000 }),
      makeAssistant('2026-03-01T10:06:00Z', { input_tokens: 30000, output_tokens: 3000, cache_read_input_tokens: 5000, cache_creation_input_tokens: 2000 }),
    ];

    const result = computeTokenDelta('2026-03-01T10:05:00Z', assistants);
    // before = 100000 + 50000 + 17000 = 167000
    expect(result.before).toBe(167000);
    // after = 30000 + 5000 + 2000 = 37000
    expect(result.after).toBe(37000);
  });

  it('returns null/null when no usage data exists', () => {
    const assistants = [
      makeAssistant('2026-03-01T10:01:00Z', null),
      makeAssistant('2026-03-01T10:06:00Z', null),
    ];

    const result = computeTokenDelta('2026-03-01T10:05:00Z', assistants);
    expect(result.before).toBeNull();
    expect(result.after).toBeNull();
  });

  it('returns partial nulls when only one side has usage', () => {
    const assistants = [
      makeAssistant('2026-03-01T10:01:00Z', { input_tokens: 100000, output_tokens: 5000 }),
      makeAssistant('2026-03-01T10:06:00Z', null),
    ];

    const result = computeTokenDelta('2026-03-01T10:05:00Z', assistants);
    expect(result.before).toBe(100000); // no cache tokens
    expect(result.after).toBeNull();
  });

  it('handles empty assistant array', () => {
    const result = computeTokenDelta('2026-03-01T10:05:00Z', []);
    expect(result.before).toBeNull();
    expect(result.after).toBeNull();
  });
});
