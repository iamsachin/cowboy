export interface DiffLine {
  type: 'add' | 'remove' | 'unchanged';
  content: string;
  oldLineNum?: number;
  newLineNum?: number;
}

export interface DiffResult {
  lines: DiffLine[];
  additions: number;
  deletions: number;
  truncated: boolean;
}

const MAX_LINES = 500;

export function computeLineDiff(oldText: string, newText: string): DiffResult {
  // Handle both-empty case
  if (oldText === '' && newText === '') {
    return { lines: [], additions: 0, deletions: 0, truncated: false };
  }

  let oldLines = oldText === '' ? [] : oldText.split('\n');
  let newLines = newText === '' ? [] : newText.split('\n');

  // Truncation guard
  let truncated = false;
  if (oldLines.length > MAX_LINES || newLines.length > MAX_LINES) {
    truncated = true;
    oldLines = oldLines.slice(0, MAX_LINES);
    newLines = newLines.slice(0, MAX_LINES);
  }

  const m = oldLines.length;
  const n = newLines.length;

  // Build LCS table
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to produce diff
  const stack: DiffLine[] = [];
  let i = m;
  let j = n;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      stack.push({ type: 'unchanged', content: oldLines[i - 1], oldLineNum: i, newLineNum: j });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      stack.push({ type: 'add', content: newLines[j - 1], newLineNum: j });
      j--;
    } else {
      stack.push({ type: 'remove', content: oldLines[i - 1], oldLineNum: i });
      i--;
    }
  }

  // Reverse stack (built backwards)
  const lines: DiffLine[] = [];
  while (stack.length > 0) lines.push(stack.pop()!);

  const additions = lines.filter((l) => l.type === 'add').length;
  const deletions = lines.filter((l) => l.type === 'remove').length;

  return { lines, additions, deletions, truncated };
}
