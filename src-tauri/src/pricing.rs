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
    m.insert("claude-opus-5-5", ModelPricing { input_per_m_tok: 6.0, output_per_m_tok: 30.0, cache_read_per_m_tok: 0.60, cache_creation_per_m_tok: 7.50 });
    m.insert("claude-opus-5", ModelPricing { input_per_m_tok: 5.0, output_per_m_tok: 25.0, cache_read_per_m_tok: 0.50, cache_creation_per_m_tok: 6.25 });
    m.insert("claude-opus-4-6", ModelPricing { input_per_m_tok: 5.0, output_per_m_tok: 25.0, cache_read_per_m_tok: 0.50, cache_creation_per_m_tok: 6.25 });
    m.insert("claude-opus-4-5", ModelPricing { input_per_m_tok: 5.0, output_per_m_tok: 25.0, cache_read_per_m_tok: 0.50, cache_creation_per_m_tok: 6.25 });
    m.insert("claude-opus-4-1", ModelPricing { input_per_m_tok: 15.0, output_per_m_tok: 75.0, cache_read_per_m_tok: 1.50, cache_creation_per_m_tok: 18.75 });
    m.insert("claude-opus-4-0", ModelPricing { input_per_m_tok: 15.0, output_per_m_tok: 75.0, cache_read_per_m_tok: 1.50, cache_creation_per_m_tok: 18.75 });
    m.insert("claude-3-opus", ModelPricing { input_per_m_tok: 15.0, output_per_m_tok: 75.0, cache_read_per_m_tok: 1.50, cache_creation_per_m_tok: 18.75 });

    // Sonnet family
    m.insert("claude-sonnet-5-5", ModelPricing { input_per_m_tok: 3.0, output_per_m_tok: 15.0, cache_read_per_m_tok: 0.30, cache_creation_per_m_tok: 3.75 });
    m.insert("claude-sonnet-4-6", ModelPricing { input_per_m_tok: 3.0, output_per_m_tok: 15.0, cache_read_per_m_tok: 0.30, cache_creation_per_m_tok: 3.75 });
    m.insert("claude-sonnet-4-5", ModelPricing { input_per_m_tok: 3.0, output_per_m_tok: 15.0, cache_read_per_m_tok: 0.30, cache_creation_per_m_tok: 3.75 });
    m.insert("claude-sonnet-4-0", ModelPricing { input_per_m_tok: 3.0, output_per_m_tok: 15.0, cache_read_per_m_tok: 0.30, cache_creation_per_m_tok: 3.75 });
    m.insert("claude-3-5-sonnet", ModelPricing { input_per_m_tok: 3.0, output_per_m_tok: 15.0, cache_read_per_m_tok: 0.30, cache_creation_per_m_tok: 3.75 });
    m.insert("claude-3-sonnet", ModelPricing { input_per_m_tok: 3.0, output_per_m_tok: 15.0, cache_read_per_m_tok: 0.30, cache_creation_per_m_tok: 3.75 });

    // Haiku family
    m.insert("claude-haiku-4-5", ModelPricing { input_per_m_tok: 1.0, output_per_m_tok: 5.0, cache_read_per_m_tok: 0.10, cache_creation_per_m_tok: 1.25 });
    m.insert("claude-3-5-haiku", ModelPricing { input_per_m_tok: 0.80, output_per_m_tok: 4.0, cache_read_per_m_tok: 0.08, cache_creation_per_m_tok: 1.00 });
    m.insert("claude-3-haiku", ModelPricing { input_per_m_tok: 0.25, output_per_m_tok: 1.25, cache_read_per_m_tok: 0.03, cache_creation_per_m_tok: 0.30 });

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

pub struct CostBreakdown {
    pub input: f64,
    pub output: f64,
    pub cache_read: f64,
    pub cache_creation: f64,
}

/// Per-component cost for a usage record, for the cost breakdown chart.
/// Returns None if model not found in pricing table.
pub fn cost_breakdown(
    model: &str,
    input_tokens: i64,
    output_tokens: i64,
    cache_read_tokens: i64,
    cache_creation_tokens: i64,
) -> Option<CostBreakdown> {
    let pricing = MODEL_PRICING.get(model).or_else(|| {
        MODEL_PRICING
            .iter()
            .find(|(key, _)| model.contains(*key))
            .map(|(_, v)| v)
    })?;

    let per_tok = |tokens: i64, rate: f64| tokens as f64 * rate / 1_000_000.0;

    Some(CostBreakdown {
        input: per_tok(input_tokens, pricing.input_per_m_tok),
        output: per_tok(output_tokens, pricing.output_per_m_tok),
        cache_read: per_tok(cache_read_tokens, pricing.cache_read_per_m_tok),
        cache_creation: per_tok(cache_creation_tokens, pricing.cache_read_per_m_tok),
    })
}

/// Share of the would-be cost that caching saved, as a percentage (0-100).
pub fn percent_saved(result: &CostResult) -> f64 {
    let would_be = result.cost + result.savings;
    if would_be <= 0.0 {
        return 0.0;
    }
    result.savings / would_be * 100.0
}
