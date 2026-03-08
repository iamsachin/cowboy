export interface ModelBadgeInfo {
  label: string;
  cssClass: string;
}

// Ordered matchers: first match wins. More specific patterns must come first.
const MODEL_MATCHERS: Array<{ pattern: string; info: ModelBadgeInfo }> = [
  { pattern: 'opus',     info: { label: 'Opus',     cssClass: 'badge-model-opus' } },
  { pattern: 'sonnet',   info: { label: 'Sonnet',   cssClass: 'badge-model-sonnet' } },
  { pattern: 'haiku',    info: { label: 'Haiku',    cssClass: 'badge-model-haiku' } },
  { pattern: 'gpt-4o',   info: { label: 'GPT-4o',   cssClass: 'badge-model-gpt4o' } },
  { pattern: 'gpt-4',    info: { label: 'GPT-4',    cssClass: 'badge-model-gpt4' } },
  { pattern: 'gpt-3',    info: { label: 'GPT-3.5',  cssClass: 'badge-model-gpt35' } },
  { pattern: 'o1',       info: { label: 'o1',        cssClass: 'badge-model-o1' } },
  { pattern: 'o3',       info: { label: 'o3',        cssClass: 'badge-model-o3' } },
  { pattern: 'gemini',   info: { label: 'Gemini',   cssClass: 'badge-model-gemini' } },
  { pattern: 'deepseek', info: { label: 'DeepSeek', cssClass: 'badge-model-deepseek' } },
];

const FALLBACK: ModelBadgeInfo = { label: '', cssClass: 'badge-ghost' };

export function getModelBadge(modelString: string | null): ModelBadgeInfo {
  if (!modelString) return FALLBACK;
  const lower = modelString.toLowerCase();
  for (const { pattern, info } of MODEL_MATCHERS) {
    const regex = new RegExp(`(?:^|[-_./\\s])${pattern}(?:$|[-_./\\s])`, 'i');
    if (regex.test(lower)) return { ...info };
  }
  // Unknown model: use raw string with ghost styling
  return { label: modelString, cssClass: 'badge-ghost' };
}
