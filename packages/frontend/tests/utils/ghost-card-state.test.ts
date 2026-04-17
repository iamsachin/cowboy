import { describe, it, expect } from 'vitest';
import { classifyGhostState } from '../../src/utils/ghost-card-state';
import type { SubagentSummary } from '../../src/types';

const fakeSummary: SubagentSummary = {
  toolBreakdown: { Read: 1 },
  filesTouched: [],
  totalToolCalls: 1,
  status: 'success',
  durationMs: 100,
  inputTokens: 0,
  outputTokens: 0,
  lastError: null,
  matchConfidence: 'high',
};

describe('classifyGhostState', () => {
  it('summary wins when summary present (everything else default)', () => {
    expect(classifyGhostState({
      subagentSummary: fakeSummary,
      subagentLinkAttempted: false,
      subagentConversationId: null,
      isActive: true,
    })).toBe('summary');
  });

  it('summary wins regardless of flag/link/active', () => {
    expect(classifyGhostState({
      subagentSummary: fakeSummary,
      subagentLinkAttempted: true,
      subagentConversationId: 'conv-x',
      isActive: false,
    })).toBe('summary');
  });

  it('missing: link exists but summary absent', () => {
    expect(classifyGhostState({
      subagentSummary: null,
      subagentLinkAttempted: true,
      subagentConversationId: 'conv-x',
      isActive: false,
    })).toBe('missing');
  });

  it('missing: link exists, active, no summary, flag not yet set', () => {
    expect(classifyGhostState({
      subagentSummary: null,
      subagentLinkAttempted: false,
      subagentConversationId: 'conv-x',
      isActive: true,
    })).toBe('missing');
  });

  it('unmatched: linker ran, no link, no summary', () => {
    expect(classifyGhostState({
      subagentSummary: null,
      subagentLinkAttempted: true,
      subagentConversationId: null,
      isActive: false,
    })).toBe('unmatched');
  });

  it('unmatched: active does not re-promote once flag is set', () => {
    expect(classifyGhostState({
      subagentSummary: null,
      subagentLinkAttempted: true,
      subagentConversationId: null,
      isActive: true,
    })).toBe('unmatched');
  });

  it('running: flag not set, active', () => {
    expect(classifyGhostState({
      subagentSummary: null,
      subagentLinkAttempted: false,
      subagentConversationId: null,
      isActive: true,
    })).toBe('running');
  });

  it('running: flag not set, idle (legacy pre-migration row)', () => {
    expect(classifyGhostState({
      subagentSummary: null,
      subagentLinkAttempted: false,
      subagentConversationId: null,
      isActive: false,
    })).toBe('running');
  });
});
