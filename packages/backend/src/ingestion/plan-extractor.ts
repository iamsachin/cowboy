// Plan extraction engine - extracts multi-step plans from assistant messages
// using heuristic pattern matching (line-by-line scanning, NOT multi-line regex)

export interface ExtractedPlan {
  title: string;
  sourceMessageId: string;
  steps: ExtractedStep[];
}

export interface ExtractedStep {
  stepNumber: number;
  content: string;
  isChecked: boolean | null; // null = not a checkbox, true = [x], false = [ ]
}

export interface CompletionContext {
  laterMessages: Array<{ role: string; content: string | null }>;
  toolCalls: Array<{ name: string; input: unknown; status: string | null }>;
}

// ── Regex patterns ──────────────────────────────────────────────────

// Numbered list pattern: "1. Create the file" / "1) Add the handler"
const NUMBERED_STEP_RE = /^\s*(\d+)[.)]\s+(.+)$/;

// Checkbox pattern: "- [ ] Create the file" / "- [x] Add the handler"
const CHECKBOX_RE = /^\s*-\s*\[([ xX])\]\s+(.+)$/;

// Explicit step pattern: "Step 1: Create the file"
const EXPLICIT_STEP_RE = /^\s*[Ss]tep\s+(\d+)[:.]\s*(.+)$/;

// ── Action verb set ─────────────────────────────────────────────────

const ACTION_VERBS = new Set([
  'create', 'add', 'update', 'delete', 'remove', 'write', 'read',
  'run', 'execute', 'install', 'configure', 'set', 'build', 'deploy',
  'test', 'fix', 'implement', 'modify', 'change', 'move', 'copy',
  'rename', 'open', 'close', 'check', 'verify', 'ensure', 'define',
  'export', 'import', 'refactor', 'migrate', 'merge', 'push', 'pull',
  'commit', 'start', 'stop', 'restart', 'replace', 'insert', 'edit',
  'wrap', 'extract', 'split', 'combine', 'connect', 'disconnect',
  'enable', 'disable', 'register', 'unregister', 'initialize', 'setup',
]);

function hasActionVerb(stepContent: string): boolean {
  const firstWord = stepContent.trim().split(/\s+/)[0]?.toLowerCase();
  return ACTION_VERBS.has(firstWord || '');
}

// ── Pattern type enum ───────────────────────────────────────────────

type PatternType = 'numbered' | 'checkbox' | 'explicit';

interface ParsedLine {
  type: PatternType;
  stepNumber: number;
  content: string;
  isChecked: boolean | null;
}

function parseLine(line: string): ParsedLine | null {
  // Try checkbox first (most specific)
  const checkboxMatch = line.match(CHECKBOX_RE);
  if (checkboxMatch) {
    return {
      type: 'checkbox',
      stepNumber: 0, // will be assigned later
      content: checkboxMatch[2].trim(),
      isChecked: checkboxMatch[1].toLowerCase() === 'x',
    };
  }

  // Try explicit step pattern
  const explicitMatch = line.match(EXPLICIT_STEP_RE);
  if (explicitMatch) {
    return {
      type: 'explicit',
      stepNumber: parseInt(explicitMatch[1], 10),
      content: explicitMatch[2].trim(),
      isChecked: null,
    };
  }

  // Try numbered list pattern
  const numberedMatch = line.match(NUMBERED_STEP_RE);
  if (numberedMatch) {
    return {
      type: 'numbered',
      stepNumber: parseInt(numberedMatch[1], 10),
      content: numberedMatch[2].trim(),
      isChecked: null,
    };
  }

  return null;
}

// ── Markdown cleaning ───────────────────────────────────────────────

export function cleanMarkdown(text: string): string {
  let cleaned = text;
  // Strip heading prefixes: # ## ### etc.
  cleaned = cleaned.replace(/^#{1,6}\s+/, '');
  // Strip bold/italic markers: ** __ * _
  cleaned = cleaned.replace(/\*\*(.+?)\*\*/g, '$1');
  cleaned = cleaned.replace(/__(.+?)__/g, '$1');
  cleaned = cleaned.replace(/\*(.+?)\*/g, '$1');
  cleaned = cleaned.replace(/_(.+?)_/g, '$1');
  // Strip backtick wrappers (inline code)
  cleaned = cleaned.replace(/`(.+?)`/g, '$1');
  return cleaned.trim();
}

// ── Title inference ─────────────────────────────────────────────────

function inferTitle(
  precedingLines: string[],
  firstStepContent: string,
  conversationTitle?: string,
): string {
  // Look backwards for a short non-empty line that looks like a heading
  for (let i = precedingLines.length - 1; i >= 0; i--) {
    const line = precedingLines[i].trim();
    if (line.length === 0) continue;
    // Short line (<80 chars), not ending with a period (unless colon)
    if (line.length < 80 && (line.endsWith(':') || !line.endsWith('.'))) {
      // Strip trailing colon for cleaner title, then clean markdown artifacts
      const raw = line.endsWith(':') ? line.slice(0, -1).trim() : line;
      return cleanMarkdown(raw);
    }
    break; // Stop at first non-empty non-qualifying line
  }

  // Fallback 1: conversation title (if provided and non-empty)
  if (conversationTitle && conversationTitle.trim().length > 0) {
    return cleanMarkdown(conversationTitle.trim());
  }

  // Fallback 2: truncated first step content
  const cleaned = cleanMarkdown(firstStepContent);
  return cleaned.length > 80
    ? cleaned.substring(0, 77) + '...'
    : cleaned;
}

// ── Main extraction function ────────────────────────────────────────

export function extractPlans(content: string, messageId: string, conversationTitle?: string): ExtractedPlan[] {
  const lines = content.split('\n');
  const plans: ExtractedPlan[] = [];

  let currentSteps: ParsedLine[] = [];
  let currentType: PatternType | null = null;
  let listStartIndex = -1;

  function finalizePlan(endIndex: number) {
    if (currentSteps.length >= 3) {
      // For numbered lists, require action verbs on >50% of steps
      if (currentType === 'numbered') {
        const actionCount = currentSteps.filter(s => hasActionVerb(s.content)).length;
        if (actionCount / currentSteps.length <= 0.5) {
          currentSteps = [];
          currentType = null;
          listStartIndex = -1;
          return;
        }
      }

      // Assign step numbers for checkbox lists
      const steps: ExtractedStep[] = currentSteps.map((s, i) => ({
        stepNumber: s.type === 'checkbox' ? i + 1 : s.stepNumber,
        content: s.content,
        isChecked: s.isChecked,
      }));

      const precedingLines = lines.slice(0, listStartIndex);
      const title = inferTitle(precedingLines, steps[0].content, conversationTitle);

      plans.push({
        title,
        sourceMessageId: messageId,
        steps,
      });
    }

    currentSteps = [];
    currentType = null;
    listStartIndex = -1;
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const parsed = parseLine(line);

    if (parsed) {
      if (currentType === null) {
        // Starting a new list
        currentType = parsed.type;
        currentSteps = [parsed];
        listStartIndex = i;
      } else if (parsed.type === currentType) {
        // Number sequence reset detection: if numbered and step number goes backwards, split
        if (currentType === 'numbered' && currentSteps.length > 0) {
          const prevStepNum = currentSteps[currentSteps.length - 1].stepNumber;
          if (parsed.stepNumber <= prevStepNum) {
            // Finalize current plan, start new one
            finalizePlan(i);
            currentType = parsed.type;
            currentSteps = [parsed];
            listStartIndex = i;
            continue;
          }
        }
        // Continuing same type of list
        currentSteps.push(parsed);
      } else {
        // Different type -- finalize current, start new
        finalizePlan(i);
        currentType = parsed.type;
        currentSteps = [parsed];
        listStartIndex = i;
      }
    } else {
      // Non-matching line
      const trimmed = line.trim();
      if (trimmed.length === 0) {
        // Empty line -- allowed within a list, don't break yet
        continue;
      }

      // Non-empty, non-matching line -- finalize current list if any
      if (currentSteps.length > 0) {
        finalizePlan(i);
      }
    }
  }

  // Finalize any remaining list at end of content
  if (currentSteps.length > 0) {
    finalizePlan(lines.length);
  }

  return plans;
}

// ── Completion inference engine ─────────────────────────────────────

const COMPLETION_SIGNALS = [
  /completed?\b/i,
  /done\b/i,
  /finished\b/i,
  /moving to (?:the )?next/i,
  /successfully/i,
];

export function inferStepCompletion(
  step: ExtractedStep,
  context: CompletionContext,
): 'complete' | 'incomplete' | 'unknown' {
  // Priority 1: Checkbox state (highest confidence)
  if (step.isChecked === true) return 'complete';
  if (step.isChecked === false) return 'incomplete';

  // Priority 2: Tool call correlation (word boundary matching)
  for (const tc of context.toolCalls) {
    const escapedName = tc.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const toolRegex = new RegExp('\\b' + escapedName + '\\b', 'i');
    if (toolRegex.test(step.content) && (tc.status === 'success' || tc.status === 'completed')) {
      return 'complete';
    }
  }

  // Priority 3: Text pattern matching in later messages
  // Extract significant words (3+ chars, skip common stopwords) from step content
  const STOPWORDS = new Set(['the', 'and', 'for', 'with', 'from', 'into', 'that', 'this', 'then', 'will', 'all', 'are', 'was', 'were', 'has', 'have', 'had']);
  const stepLower = step.content.toLowerCase();
  const stepWords = stepLower
    .split(/\s+/)
    .filter(w => w.length >= 3 && !STOPWORDS.has(w));
  // Require >60% of significant words to match (minimum 2)
  const matchThreshold = Math.max(2, Math.ceil(stepWords.length * 0.6));

  for (const msg of context.laterMessages) {
    if (!msg.content) continue;
    const msgLower = msg.content.toLowerCase();
    const matchCount = stepWords.filter(w => msgLower.includes(w)).length;
    if (matchCount >= matchThreshold) {
      for (const signal of COMPLETION_SIGNALS) {
        if (signal.test(msg.content)) return 'complete';
      }
    }
  }

  // Default: unknown (gray indicator, NOT assumed incomplete)
  return 'unknown';
}
