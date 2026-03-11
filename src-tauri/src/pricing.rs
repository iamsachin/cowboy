use std::collections::HashMap;
use std::sync::LazyLock;

pub struct ModelPricing {
    pub input_per_m_tok: f64,
    pub output_per_m_tok: f64,
    pub cache_read_per_m_tok: f64,
    pub cache_creation_per_m_tok: f64,
}

pub struct CostResult {
    pub cost: f64,
    pub savings: f64,
}

static MODEL_PRICING: LazyLock<HashMap<&'static str, ModelPricing>> = LazyLock::new(|| {
    let mut m = HashMap::new();

    // Opus family
    m.insert("claude-opus-4-6", ModelPricing { input_per_m_tok: 5.0, output_per_m_tok: 25.0, cache_read_per_m_tok: 0.50, cache_creation_per_m_tok: 6.25 });
    m.insert("claude-opus-4-5", ModelPricing { input_per_m_tok: 5.0, output_per_m_tok: 25.0, cache_read_per_m_tok: 0.50, cache_creation_per_m_tok: 6.25 });
    m.insert("claude-opus-4-1", ModelPricing { input_per_m_tok: 15.0, output_per_m_tok: 75.0, cache_read_per_m_tok: 1.50, cache_creation_per_m_tok: 18.75 });
    m.insert("claude-opus-4-0", ModelPricing { input_per_m_tok: 15.0, output_per_m_tok: 75.0, cache_read_per_m_tok: 1.50, cache_creation_per_m_tok: 18.75 });
    m.insert("claude-3-opus", ModelPricing { input_per_m_tok: 15.0, output_per_m_tok: 75.0, cache_read_per_m_tok: 1.50, cache_creation_per_m_tok: 18.75 });

    // Sonnet family
    m.insert("claude-sonnet-4-6", ModelPricing { input_per_m_tok: 3.0, output_per_m_tok: 15.0, cache_read_per_m_tok: 0.30, cache_creation_per_m_tok: 3.75 });
    m.insert("claude-sonnet-4-5", ModelPricing { input_per_m_tok: 3.0, output_per_m_tok: 15.0, cache_read_per_m_tok: 0.30, cache_creation_per_m_tok: 3.75 });
    m.insert("claude-sonnet-4-0", ModelPricing { input_per_m_tok: 3.0, output_per_m_tok: 15.0, cache_read_per_m_tok: 0.30, cache_creation_per_m_tok: 3.75 });
    m.insert("claude-3-5-sonnet", ModelPricing { input_per_m_tok: 3.0, output_per_m_tok: 15.0, cache_read_per_m_tok: 0.30, cache_creation_per_m_tok: 3.75 });
    m.insert("claude-3-sonnet", ModelPricing { input_per_m_tok: 3.0, output_per_m_tok: 15.0, cache_read_per_m_tok: 0.30, cache_creation_per_m_tok: 3.75 });

    // Haiku family
    m.insert("claude-haiku-4-5", ModelPricing { input_per_m_tok: 1.0, output_per_m_tok: 5.0, cache_read_per_m_tok: 0.10, cache_creation_per_m_tok: 1.25 });
    m.insert("claude-3-5-haiku", ModelPricing { input_per_m_tok: 0.80, output_per_m_tok: 4.0, cache_read_per_m_tok: 0.08, cache_creation_per_m_tok: 1.00 });
    m.insert("claude-3-haiku", ModelPricing { input_per_m_tok: 0.25, output_per_m_tok: 1.25, cache_read_per_m_tok: 0.03, cache_creation_per_m_tok: 0.30 });

    // Cursor-specific Claude model aliases
    m.insert("claude-4.5-sonnet", ModelPricing { input_per_m_tok: 3.0, output_per_m_tok: 15.0, cache_read_per_m_tok: 0.30, cache_creation_per_m_tok: 3.75 });
    m.insert("claude-4-sonnet", ModelPricing { input_per_m_tok: 3.0, output_per_m_tok: 15.0, cache_read_per_m_tok: 0.30, cache_creation_per_m_tok: 3.75 });

    // OpenAI models (for Cursor users)
    m.insert("gpt-4o", ModelPricing { input_per_m_tok: 2.50, output_per_m_tok: 10.0, cache_read_per_m_tok: 1.25, cache_creation_per_m_tok: 2.50 });
    m.insert("gpt-4o-mini", ModelPricing { input_per_m_tok: 0.15, output_per_m_tok: 0.60, cache_read_per_m_tok: 0.075, cache_creation_per_m_tok: 0.15 });
    m.insert("gpt-4-turbo", ModelPricing { input_per_m_tok: 10.0, output_per_m_tok: 30.0, cache_read_per_m_tok: 5.0, cache_creation_per_m_tok: 10.0 });
    m.insert("o1", ModelPricing { input_per_m_tok: 15.0, output_per_m_tok: 60.0, cache_read_per_m_tok: 7.50, cache_creation_per_m_tok: 15.0 });
    m.insert("o1-mini", ModelPricing { input_per_m_tok: 1.10, output_per_m_tok: 4.40, cache_read_per_m_tok: 0.55, cache_creation_per_m_tok: 1.10 });
    m.insert("o3", ModelPricing { input_per_m_tok: 2.0, output_per_m_tok: 8.0, cache_read_per_m_tok: 1.0, cache_creation_per_m_tok: 2.0 });
    m.insert("o3-mini", ModelPricing { input_per_m_tok: 1.10, output_per_m_tok: 4.40, cache_read_per_m_tok: 0.55, cache_creation_per_m_tok: 1.10 });
    m.insert("o4-mini", ModelPricing { input_per_m_tok: 1.10, output_per_m_tok: 4.40, cache_read_per_m_tok: 0.55, cache_creation_per_m_tok: 1.10 });

    m
});

/// Calculate cost for a token usage record.
/// Returns None if model not found in pricing table.
/// Tries exact match first, then fuzzy match (check if model string contains any key).
pub fn calculate_cost(
    model: &str,
    input_tokens: i64,
    output_tokens: i64,
    cache_read_tokens: i64,
    cache_creation_tokens: i64,
) -> Option<CostResult> {
    let pricing = MODEL_PRICING.get(model).or_else(|| {
        MODEL_PRICING
            .iter()
            .find(|(key, _)| model.contains(*key))
            .map(|(_, v)| v)
    })?;

    let cost = ((input_tokens as f64 * pricing.input_per_m_tok)
        + (output_tokens as f64 * pricing.output_per_m_tok)
        + (cache_read_tokens as f64 * pricing.cache_read_per_m_tok)
        + (cache_creation_tokens as f64 * pricing.cache_creation_per_m_tok))
        / 1_000_000.0;

    // Savings = what cache reads would have cost at full input price minus actual cache read cost
    let savings = (cache_read_tokens as f64
        * (pricing.input_per_m_tok - pricing.cache_read_per_m_tok))
        / 1_000_000.0;

    Some(CostResult { cost, savings })
}
