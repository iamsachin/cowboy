import { describe, it, expect } from 'vitest';
import { extractPlans } from '../../src/ingestion/plan-extractor.js';
import {
  NUMBERED_ACTION_PLAN,
  CHECKBOX_PLAN,
  EXPLICIT_STEP_PLAN,
  EXPLANATORY_LIST,
  SHORT_PLAN,
  MULTIPLE_PLANS,
  MIXED_CONTENT,
  MARKDOWN_HEADING_TITLE,
  MARKDOWN_BOLD_TITLE,
  MARKDOWN_BACKTICK_TITLE,
  SPLIT_BY_PROSE,
  SPLIT_BY_HEADING,
  NUMBER_RESET,
  PARTIAL_ACTION_VERBS_ACCEPTED,
  PARTIAL_ACTION_VERBS_REJECTED,
} from '../fixtures/seed-plans.js';

describe('extractPlans', () => {
  describe('numbered action lists', () => {
    it('extracts a numbered list with imperative verbs', () => {
      const plans = extractPlans(NUMBERED_ACTION_PLAN, 'msg-1');
      expect(plans).toHaveLength(1);
      expect(plans[0].steps).toHaveLength(5);
      expect(plans[0].sourceMessageId).toBe('msg-1');
      expect(plans[0].steps[0].stepNumber).toBe(1);
      expect(plans[0].steps[0].content).toBe('Create the project directory structure');
      expect(plans[0].steps[4].stepNumber).toBe(5);
      expect(plans[0].steps[4].content).toBe('Start the development server');
      // Numbered steps should have null isChecked
      expect(plans[0].steps[0].isChecked).toBeNull();
    });
  });

  describe('checkbox lists', () => {
    it('extracts a checkbox list with checked/unchecked state', () => {
      const plans = extractPlans(CHECKBOX_PLAN, 'msg-2');
      expect(plans).toHaveLength(1);
      expect(plans[0].steps).toHaveLength(4);
      expect(plans[0].steps[0].content).toBe('Create the API routes');
      expect(plans[0].steps[0].isChecked).toBe(true);
      expect(plans[0].steps[1].content).toBe('Add input validation');
      expect(plans[0].steps[1].isChecked).toBe(true);
      expect(plans[0].steps[2].content).toBe('Write unit tests');
      expect(plans[0].steps[2].isChecked).toBe(false);
      expect(plans[0].steps[3].content).toBe('Deploy to staging');
      expect(plans[0].steps[3].isChecked).toBe(false);
    });

    it('does NOT require action verb check for checkbox lists', () => {
      // Checkbox items like "Deploy to staging" imply action even without imperative verb
      const content = `Tasks:\n\n- [ ] The deployment pipeline\n- [ ] The monitoring setup\n- [ ] The alerting system`;
      const plans = extractPlans(content, 'msg-checkbox-no-verb');
      expect(plans).toHaveLength(1);
      expect(plans[0].steps).toHaveLength(3);
    });
  });

  describe('explicit Step N patterns', () => {
    it('extracts explicit Step N: pattern', () => {
      const plans = extractPlans(EXPLICIT_STEP_PLAN, 'msg-3');
      expect(plans).toHaveLength(1);
      expect(plans[0].steps).toHaveLength(3);
      expect(plans[0].steps[0].stepNumber).toBe(1);
      expect(plans[0].steps[0].content).toBe('Create the new component file');
      expect(plans[0].steps[2].stepNumber).toBe(3);
      expect(plans[0].steps[2].content).toBe('Write integration tests');
      expect(plans[0].steps[0].isChecked).toBeNull();
    });
  });

  describe('rejection criteria', () => {
    it('rejects explanatory/non-actionable numbered lists', () => {
      const plans = extractPlans(EXPLANATORY_LIST, 'msg-4');
      expect(plans).toHaveLength(0);
    });

    it('rejects lists with fewer than 3 steps', () => {
      const plans = extractPlans(SHORT_PLAN, 'msg-5');
      expect(plans).toHaveLength(0);
    });
  });

  describe('title inference', () => {
    it('uses preceding short line as title', () => {
      const plans = extractPlans(NUMBERED_ACTION_PLAN, 'msg-title');
      expect(plans).toHaveLength(1);
      // "Here's the setup plan:" should be inferred as title (short line before list)
      expect(plans[0].title).toBeTruthy();
      expect(plans[0].title.length).toBeLessThanOrEqual(80);
    });

    it('falls back to truncated first step when no title line', () => {
      const noTitleContent = `1. Create the project structure\n2. Install dependencies\n3. Run the build`;
      const plans = extractPlans(noTitleContent, 'msg-no-title');
      expect(plans).toHaveLength(1);
      expect(plans[0].title).toBeTruthy();
      expect(plans[0].title.length).toBeLessThanOrEqual(80);
    });
  });

  describe('mixed content', () => {
    it('extracts plan from prose with embedded plan', () => {
      const plans = extractPlans(MIXED_CONTENT, 'msg-mixed');
      expect(plans).toHaveLength(1);
      expect(plans[0].steps).toHaveLength(4);
      expect(plans[0].steps[0].content).toBe('Create the WebSocket handler');
    });
  });

  describe('multiple plans', () => {
    it('extracts multiple qualifying plans from one message', () => {
      const plans = extractPlans(MULTIPLE_PLANS, 'msg-multi');
      expect(plans).toHaveLength(2);
      expect(plans[0].steps).toHaveLength(3);
      expect(plans[1].steps).toHaveLength(3);
    });
  });

  describe('title markdown stripping (PLAN-01)', () => {
    it('strips ## heading prefix from title', () => {
      const plans = extractPlans(MARKDOWN_HEADING_TITLE, 'msg-md-heading');
      expect(plans).toHaveLength(1);
      expect(plans[0].title).toBe('Setup Plan');
    });

    it('strips **bold** markers from title', () => {
      const plans = extractPlans(MARKDOWN_BOLD_TITLE, 'msg-md-bold');
      expect(plans).toHaveLength(1);
      expect(plans[0].title).toBe('Bold Title');
    });

    it('strips backtick wrappers from title', () => {
      const plans = extractPlans(MARKDOWN_BACKTICK_TITLE, 'msg-md-backtick');
      expect(plans).toHaveLength(1);
      expect(plans[0].title).toBe('Config Setup');
    });
  });

  describe('conversation title fallback (PLAN-02)', () => {
    it('uses conversation title when no heading found', () => {
      const noTitleContent = `1. Create the project structure\n2. Install dependencies\n3. Run the build`;
      const plans = extractPlans(noTitleContent, 'msg-conv-title', 'My Custom Project');
      expect(plans).toHaveLength(1);
      expect(plans[0].title).toBe('My Custom Project');
    });
  });

  describe('list splitting (PLAN-03)', () => {
    it('splits two numbered lists separated by prose into 2 plans', () => {
      const plans = extractPlans(SPLIT_BY_PROSE, 'msg-split-prose');
      expect(plans).toHaveLength(2);
      expect(plans[0].steps).toHaveLength(3);
      expect(plans[1].steps).toHaveLength(3);
    });

    it('splits two numbered lists separated by a heading into 2 plans', () => {
      const plans = extractPlans(SPLIT_BY_HEADING, 'msg-split-heading');
      expect(plans).toHaveLength(2);
      expect(plans[0].steps).toHaveLength(3);
      expect(plans[1].steps).toHaveLength(3);
    });

    it('splits on number sequence reset (5 then 1)', () => {
      const plans = extractPlans(NUMBER_RESET, 'msg-num-reset');
      expect(plans).toHaveLength(2);
      expect(plans[0].steps).toHaveLength(5);
      expect(plans[1].steps).toHaveLength(3);
    });
  });

  describe('action verb threshold (PLAN-04)', () => {
    it('accepts a numbered list where 60% of steps have action verbs', () => {
      const plans = extractPlans(PARTIAL_ACTION_VERBS_ACCEPTED, 'msg-partial-accept');
      expect(plans).toHaveLength(1);
      expect(plans[0].steps).toHaveLength(5);
    });

    it('rejects a numbered list where only 20% of steps have action verbs', () => {
      const plans = extractPlans(PARTIAL_ACTION_VERBS_REJECTED, 'msg-partial-reject');
      expect(plans).toHaveLength(0);
    });
  });
});
