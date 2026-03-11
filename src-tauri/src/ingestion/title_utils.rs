/// Determine whether a user message should be skipped when deriving a title.
///
/// Skip order (first match wins):
/// 1. Empty or whitespace-only
/// 2. Slash commands (starts with "/")
/// 3. System caveats (starts with "Caveat:")
/// 4. Interrupted requests (starts with "[Request interrupted")
/// 5. XML/system messages (starts with "<")
pub fn should_skip_for_title(content: &str) -> bool {
    let trimmed = content.trim();

    if trimmed.is_empty() {
        return true;
    }
    if trimmed.starts_with('/') {
        return true;
    }
    if trimmed.starts_with("Caveat:") {
        return true;
    }
    if trimmed.starts_with("[Request interrupted") {
        return true;
    }
    if trimmed.starts_with('<') {
        return true;
    }

    false
}

fn strip_xml_tags(text: &str) -> String {
    // Remove all XML tags
    let re = regex::Regex::new(r"<[^>]*>").unwrap();
    re.replace_all(text, "").trim().to_string()
}

fn truncate(text: &str, max_len: usize) -> String {
    if text.len() > max_len {
        text[..max_len].to_string()
    } else {
        text.to_string()
    }
}

/// Derive a conversation title from user messages with optional assistant-text fallback.
///
/// Fallback chain:
/// 1. First non-skippable user message content (truncated to 100 chars)
/// 2. First XML-stripped user message with >10 chars of cleaned text
/// 3. First non-null assistant text snippet (truncated to 100 chars)
/// 4. None
pub fn derive_conversation_title(
    user_messages: &[Option<&str>],
    assistant_text_snippets: Option<&[Option<&str>]>,
) -> Option<String> {
    // First pass: find first non-skippable user message
    for content in user_messages {
        if let Some(text) = content {
            let trimmed = text.trim();
            if !trimmed.is_empty() {
                if should_skip_for_title(text) {
                    continue;
                }
                return Some(truncate(text, 100));
            }
        }
    }

    // Second pass: XML fallback
    for content in user_messages {
        if let Some(text) = content {
            if text.trim().starts_with('<') {
                let stripped = strip_xml_tags(text);
                if stripped.len() > 10 {
                    return Some(truncate(&stripped, 100));
                }
            }
        }
    }

    // Third pass: assistant text fallback
    if let Some(snippets) = assistant_text_snippets {
        for snippet in snippets {
            if let Some(text) = snippet {
                if !text.trim().is_empty() {
                    return Some(truncate(text, 100));
                }
            }
        }
    }

    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn skip_slash_command() {
        assert!(should_skip_for_title("/command"));
    }

    #[test]
    fn allow_normal_text() {
        assert!(!should_skip_for_title("Hello world"));
    }

    #[test]
    fn skip_caveat() {
        assert!(should_skip_for_title("Caveat: this is a caveat"));
    }

    #[test]
    fn skip_xml() {
        assert!(should_skip_for_title("<system-reminder>some content</system-reminder>"));
    }

    #[test]
    fn skip_empty() {
        assert!(should_skip_for_title(""));
        assert!(should_skip_for_title("   "));
    }

    #[test]
    fn skip_interrupted() {
        assert!(should_skip_for_title("[Request interrupted by user"));
    }

    #[test]
    fn derive_title_first_non_skippable() {
        let msgs: Vec<Option<&str>> = vec![
            Some("/command"),
            Some("Hello world"),
        ];
        assert_eq!(
            derive_conversation_title(&msgs, None),
            Some("Hello world".to_string())
        );
    }

    #[test]
    fn derive_title_xml_fallback() {
        let msgs: Vec<Option<&str>> = vec![
            Some("<system-reminder>Important context for this task</system-reminder>"),
        ];
        assert_eq!(
            derive_conversation_title(&msgs, None),
            Some("Important context for this task".to_string())
        );
    }

    #[test]
    fn derive_title_assistant_fallback() {
        let msgs: Vec<Option<&str>> = vec![
            Some("/command"),
        ];
        let snippets: Vec<Option<&str>> = vec![
            Some("I'll help you with that"),
        ];
        assert_eq!(
            derive_conversation_title(&msgs, Some(&snippets)),
            Some("I'll help you with that".to_string())
        );
    }

    #[test]
    fn derive_title_truncation() {
        let long_msg = "a".repeat(200);
        let msgs: Vec<Option<&str>> = vec![Some(&long_msg)];
        let result = derive_conversation_title(&msgs, None).unwrap();
        assert_eq!(result.len(), 100);
    }
}
