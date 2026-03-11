export interface ModelPricing {
  inputPerMTok: number;
  outputPerMTok: number;
  cacheReadPerMTok: number;
  cacheCreationPerMTok: number;
}

/**
 * Hardcoded pricing table for Claude models.
 * Keys are model name patterns that appear in conversation data.
 * Cache read = 0.1x base input. Cache creation (5min) = 1.25x base input.
 */
export const MODEL_PRICING: Record<string, ModelPricing> = {
  // Opus family
  'claude-opus-4-6':       { inputPerMTok: 5,    outputPerMTok: 25,   cacheReadPerMTok: 0.50,  cacheCreationPerMTok: 6.25 },
  'claude-opus-4-5':       { inputPerMTok: 5,    outputPerMTok: 25,   cacheReadPerMTok: 0.50,  cacheCreationPerMTok: 6.25 },
  'claude-opus-4-1':       { inputPerMTok: 15,   outputPerMTok: 75,   cacheReadPerMTok: 1.50,  cacheCreationPerMTok: 18.75 },
  'claude-opus-4-0':       { inputPerMTok: 15,   outputPerMTok: 75,   cacheReadPerMTok: 1.50,  cacheCreationPerMTok: 18.75 },
  'claude-3-opus':         { inputPerMTok: 15,   outputPerMTok: 75,   cacheReadPerMTok: 1.50,  cacheCreationPerMTok: 18.75 },

  // Sonnet family
  'claude-sonnet-4-6':     { inputPerMTok: 3,    outputPerMTok: 15,   cacheReadPerMTok: 0.30,  cacheCreationPerMTok: 3.75 },
  'claude-sonnet-4-5':     { inputPerMTok: 3,    outputPerMTok: 15,   cacheReadPerMTok: 0.30,  cacheCreationPerMTok: 3.75 },
  'claude-sonnet-4-0':     { inputPerMTok: 3,    outputPerMTok: 15,   cacheReadPerMTok: 0.30,  cacheCreationPerMTok: 3.75 },
  'claude-3-5-sonnet':     { inputPerMTok: 3,    outputPerMTok: 15,   cacheReadPerMTok: 0.30,  cacheCreationPerMTok: 3.75 },
  'claude-3-sonnet':       { inputPerMTok: 3,    outputPerMTok: 15,   cacheReadPerMTok: 0.30,  cacheCreationPerMTok: 3.75 },

  // Haiku family
  'claude-haiku-4-5':      { inputPerMTok: 1,    outputPerMTok: 5,    cacheReadPerMTok: 0.10,  cacheCreationPerMTok: 1.25 },
  'claude-3-5-haiku':      { inputPerMTok: 0.80, outputPerMTok: 4,    cacheReadPerMTok: 0.08,  cacheCreationPerMTok: 1.00 },
  'claude-3-haiku':        { inputPerMTok: 0.25, outputPerMTok: 1.25, cacheReadPerMTok: 0.03,  cacheCreationPerMTok: 0.30 },

  // Cursor-specific Claude model aliases (Cursor uses different naming convention)
  'claude-4.5-sonnet':     { inputPerMTok: 3,    outputPerMTok: 15,   cacheReadPerMTok: 0.30,  cacheCreationPerMTok: 3.75 },
  'claude-4-sonnet':       { inputPerMTok: 3,    outputPerMTok: 15,   cacheReadPerMTok: 0.30,  cacheCreationPerMTok: 3.75 },

  // OpenAI models (for Cursor users who use GPT models)
  'gpt-4o':                { inputPerMTok: 2.50, outputPerMTok: 10,   cacheReadPerMTok: 1.25,  cacheCreationPerMTok: 2.50 },
  'gpt-4o-mini':           { inputPerMTok: 0.15, outputPerMTok: 0.60, cacheReadPerMTok: 0.075, cacheCreationPerMTok: 0.15 },
  'gpt-4-turbo':           { inputPerMTok: 10,   outputPerMTok: 30,   cacheReadPerMTok: 5,     cacheCreationPerMTok: 10 },
  'o1':                    { inputPerMTok: 15,   outputPerMTok: 60,   cacheReadPerMTok: 7.50,  cacheCreationPerMTok: 15 },
  'o1-mini':               { inputPerMTok: 1.10, outputPerMTok: 4.40, cacheReadPerMTok: 0.55,  cacheCreationPerMTok: 1.10 },
  'o3':                    { inputPerMTok: 2,    outputPerMTok: 8,    cacheReadPerMTok: 1,     cacheCreationPerMTok: 2 },
  'o3-mini':               { inputPerMTok: 1.10, outputPerMTok: 4.40, cacheReadPerMTok: 0.55,  cacheCreationPerMTok: 1.10 },
  'o4-mini':               { inputPerMTok: 1.10, outputPerMTok: 4.40, cacheReadPerMTok: 0.55,  cacheCreationPerMTok: 1.10 },
};

/**
 * Calculate cost for a token usage record.
 * Returns null if model not found in pricing table.
 * Tries exact match first, then fuzzy match (check if any key is contained in the model string).
 */
export function calculateCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
  cacheReadTokens: number,
  cacheCreationTokens: number,
): { cost: number; savings: number } | null {
  const pricing = MODEL_PRICING[model]
    ?? Object.entries(MODEL_PRICING).find(([key]) => model.includes(key))?.[1];

  if (!pricing) return null;

  const cost = (
    (inputTokens * pricing.inputPerMTok) +
    (outputTokens * pricing.outputPerMTok) +
    (cacheReadTokens * pricing.cacheReadPerMTok) +
    (cacheCreationTokens * pricing.cacheCreationPerMTok)
  ) / 1_000_000;

  // Savings = what cache reads would have cost at full input price minus what they actually cost
  const savings = (cacheReadTokens * (pricing.inputPerMTok - pricing.cacheReadPerMTok)) / 1_000_000;

  return { cost, savings };
}
