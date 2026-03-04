import { describe, it, expect } from 'vitest';
import { inferStepCompletion, ExtractedStep, CompletionContext } from '../../src/ingestion/plan-extractor.js';

describe('inferStepCompletion', () => {
  const emptyContext: CompletionContext = {
    laterMessages: [],
    toolCalls: [],
  };

  describe('Priority 1: checkbox state', () => {
    it('returns "complete" for checked checkbox [x]', () => {
      const step: ExtractedStep = { stepNumber: 1, content: 'Create the file', isChecked: true };
      expect(inferStepCompletion(step, emptyContext)).toBe('complete');
    });

    it('returns "incomplete" for unchecked checkbox [ ]', () => {
      const step: ExtractedStep = { stepNumber: 1, content: 'Create the file', isChecked: false };
      expect(inferStepCompletion(step, emptyContext)).toBe('incomplete');
    });
  });

  describe('Priority 2: tool call correlation', () => {
    it('returns "complete" when step content mentions a successful tool call name', () => {
      const step: ExtractedStep = { stepNumber: 1, content: 'Read the config file', isChecked: null };
      const context: CompletionContext = {
        laterMessages: [],
        toolCalls: [
          { name: 'Read', input: { path: 'config.ts' }, status: 'success' },
        ],
      };
      expect(inferStepCompletion(step, context)).toBe('complete');
    });

    it('returns "complete" for tool call with "completed" status', () => {
      const step: ExtractedStep = { stepNumber: 1, content: 'Write the output file', isChecked: null };
      const context: CompletionContext = {
        laterMessages: [],
        toolCalls: [
          { name: 'Write', input: { path: 'out.ts' }, status: 'completed' },
        ],
      };
      expect(inferStepCompletion(step, context)).toBe('complete');
    });

    it('does NOT mark complete if tool call failed', () => {
      const step: ExtractedStep = { stepNumber: 1, content: 'Run the Bash command', isChecked: null };
      const context: CompletionContext = {
        laterMessages: [],
        toolCalls: [
          { name: 'Bash', input: { command: 'npm test' }, status: 'error' },
        ],
      };
      expect(inferStepCompletion(step, context)).toBe('unknown');
    });

    it('does NOT match tool call when step does not mention tool name', () => {
      const step: ExtractedStep = { stepNumber: 1, content: 'Create the project structure', isChecked: null };
      const context: CompletionContext = {
        laterMessages: [],
        toolCalls: [
          { name: 'Read', input: { path: 'file.ts' }, status: 'success' },
        ],
      };
      expect(inferStepCompletion(step, context)).toBe('unknown');
    });
  });

  describe('Priority 3: text pattern matching', () => {
    it('returns "complete" when later message references step content + completion signal', () => {
      const step: ExtractedStep = { stepNumber: 1, content: 'Create the project directory structure', isChecked: null };
      const context: CompletionContext = {
        laterMessages: [
          { role: 'assistant', content: 'I\'ve completed creating the project directory structure. Moving to the next step.' },
        ],
        toolCalls: [],
      };
      expect(inferStepCompletion(step, context)).toBe('complete');
    });

    it('returns "unknown" when later message references step but no completion signal', () => {
      const step: ExtractedStep = { stepNumber: 1, content: 'Create the project directory structure', isChecked: null };
      const context: CompletionContext = {
        laterMessages: [
          { role: 'assistant', content: 'Working on creating the project directory structure now.' },
        ],
        toolCalls: [],
      };
      expect(inferStepCompletion(step, context)).toBe('unknown');
    });
  });

  describe('default behavior', () => {
    it('returns "unknown" when no evidence exists (NOT "incomplete")', () => {
      const step: ExtractedStep = { stepNumber: 1, content: 'Deploy to production', isChecked: null };
      expect(inferStepCompletion(step, emptyContext)).toBe('unknown');
    });

    it('handles null content in later messages gracefully', () => {
      const step: ExtractedStep = { stepNumber: 1, content: 'Create the file', isChecked: null };
      const context: CompletionContext = {
        laterMessages: [
          { role: 'assistant', content: null },
        ],
        toolCalls: [],
      };
      expect(inferStepCompletion(step, context)).toBe('unknown');
    });
  });

  describe('priority ordering', () => {
    it('checkbox state takes priority over tool call correlation', () => {
      const step: ExtractedStep = { stepNumber: 1, content: 'Read the config', isChecked: false };
      const context: CompletionContext = {
        laterMessages: [],
        toolCalls: [
          { name: 'Read', input: { path: 'config.ts' }, status: 'success' },
        ],
      };
      // isChecked false should win over tool call match
      expect(inferStepCompletion(step, context)).toBe('incomplete');
    });
  });
});
