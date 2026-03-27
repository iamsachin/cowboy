use sha2::{Sha256, Digest};

/// Generate a deterministic ID from content parts.
/// Uses SHA-256 hash, truncated to 32 hex characters (128 bits).
/// Same inputs always produce the same output, enabling idempotent re-runs.
/// Matches Node.js: crypto.createHash('sha256').update(parts.join('::')).digest('hex').substring(0,32)
pub fn generate_id(parts: &[&str]) -> String {
    let joined = parts.join("::");
    let mut hasher = Sha256::new();
    hasher.update(joined.as_bytes());
    let result = hasher.finalize();
    hex::encode(&result[..16]) // 16 bytes = 32 hex chars
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn matches_nodejs_claude_code() {
        // node -e "console.log(require('crypto').createHash('sha256').update('claude-code::test-session-123').digest('hex').substring(0,32))"
        assert_eq!(
            generate_id(&["claude-code", "test-session-123"]),
            "46d0ce73948167472aae69670b3d184c"
        );
    }

    #[test]
    fn single_part() {
        // Should still work with a single part (no :: separator)
        let result = generate_id(&["hello"]);
        assert_eq!(result.len(), 32);
    }

    #[test]
    fn deterministic() {
        let a = generate_id(&["a", "b", "c"]);
        let b = generate_id(&["a", "b", "c"]);
        assert_eq!(a, b);
    }
}
