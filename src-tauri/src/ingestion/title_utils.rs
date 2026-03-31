/// Strip `[Image: source: /path/to/file.png]` and `[Image #N]` references from text.
/// These are injected by Claude Code when the user attaches images.
pub fn strip_image_refs(text: &str) -> String {
    let re = regex::Regex::new(r"\[Image:[ ][^\]]+\]|\[Image #\d+\]").unwrap();
    re.replace_all(text, "").trim().to_string()
}

/// Check whether a message is a `/clear` command (plain or XML-wrapped).
///
/// Matches:
/// - `/clear` (with optional surrounding whitespace/newlines)
/// - `<command-name>/clear</command-name>` (with optional `<command-args>`)
pub fn is_clear_command(content: &str) -> bool {
    let trimmed = content.trim();
    // Plain format: exactly "/clear" with no additional args
    if trimmed == "/clear" {
        return true;
    }
    // XML format: <command-name>/clear</command-name>
    if trimmed.contains("<command-name>/clear</command-name>") {
        return true;
    }
    false
}

/// Determine whether a user message should be skipped when deriving a title.
///
/// Skip order (first match wins):
/// 1. Empty or whitespace-only
/// 2. Slash commands (starts with "/")
/// 3. System caveats (starts with "Caveat:")
/// 4. Interrupted requests (starts with "[Request interrupted")
/// 5. XML/system messages (starts with "<")
/// 6. Image-only messages
pub fn should_skip_for_title(content: &str) -> bool {
    let trimmed = content.trim();

    if trimmed.is_empty() {
        return true;
    }
    if trimmed.len() <= 2 {
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

    // Image-only messages (e.g. "[Image: source: /path/to/file.png]")
    if trimmed.starts_with("[Image:") {
        let stripped = strip_image_refs(trimmed);
        if stripped.is_empty() {
            return true;
        }
    }

    // Skill definition messages injected by Claude Code
    if trimmed.starts_with("Base directory for this skill:") {
        return true;
    }

    // Skill/command expanded prompts with structured XML sections
    if trimmed.contains("<objective>") || trimmed.contains("<execution_context>") || trimmed.contains("<files_to_read>") {
        return true;
    }

    false
}

/// Extract the arguments portion from a slash command string or XML command message.
///
/// Supports two formats:
/// - Plain: `/gsd:quick How are plans extracted?` -> `Some("How are plans extracted?")`
/// - XML: `<command-name>/gsd:quick</command-name><command-args>How are plans?</command-args>` -> `Some("How are plans?")`
///
/// Returns `None` if the command has no args or args are too short (<=10 chars).
pub fn extract_slash_command_args(text: &str) -> Option<String> {
    let trimmed = text.trim();

    // Try XML format first: <command-args>...</command-args>
    let args_re = regex::Regex::new(r"<command-args>([\s\S]*?)</command-args>").unwrap();
    if let Some(caps) = args_re.captures(trimmed) {
        let args = caps[1].trim().to_string();
        if args.is_empty() || args.len() <= 10 {
            return None;
        }
        return Some(args);
    }

    // Plain slash command format: /command args...
    if !trimmed.starts_with('/') {
        return None;
    }
    let re = regex::Regex::new(r"^/[a-zA-Z][a-zA-Z0-9_:-]*\s*").unwrap();
    let remaining = re.replace(trimmed, "").to_string();
    let remaining = remaining.trim().to_string();
    if remaining.is_empty() || remaining.len() <= 10 {
        return None;
    }
    Some(remaining)
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
    // Find the last /clear command and only consider messages after it
    let clear_idx = user_messages.iter().rposition(|opt| {
        opt.map_or(false, |text| is_clear_command(text))
    });
    let user_slice = match clear_idx {
        Some(idx) => &user_messages[(idx + 1)..],
        None => &user_messages[..],
    };

    // First pass: find first non-skippable user message
    for content in user_slice {
        if let Some(text) = content {
            let trimmed = text.trim();
            if !trimmed.is_empty() {
                if should_skip_for_title(text) {
                    // If message has image refs, strip them and check remaining text
                    if trimmed.contains("[Image:") {
                        let cleaned = strip_image_refs(trimmed);
                        if !cleaned.is_empty() && !should_skip_for_title(&cleaned) {
                            return Some(truncate(&cleaned, 100));
                        }
                    }
                    continue;
                }
                // Also strip image refs from messages that have text + images
                let cleaned = strip_image_refs(text);
                if !cleaned.is_empty() {
                    return Some(truncate(&cleaned, 100));
                }
                return Some(truncate(text, 100));
            }
        }
    }

    // Second pass: XML fallback
    for content in user_slice {
        if let Some(text) = content {
            if text.trim().starts_with('<') {
                // Try extracting slash command args from raw XML first
                if let Some(args) = extract_slash_command_args(text) {
                    if !should_skip_for_title(&args) {
                        return Some(truncate(&args, 100));
                    }
                    continue;
                }
                let stripped = strip_xml_tags(text);
                // If stripped text is a slash command without useful args, skip it
                if stripped.starts_with('/') {
                    continue;
                }
                if stripped.len() > 10 && !should_skip_for_title(&stripped) {
                    return Some(truncate(&stripped, 100));
                }
            }
        }
    }

    // Third pass: slash command fallback -- use first slash command as title
    for content in user_slice {
        if let Some(text) = content {
            let trimmed = text.trim();
            if trimmed.starts_with('/') {
                return Some(truncate(trimmed, 100));
            }
        }
    }

    // Fourth pass: assistant text fallback
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
        // Slash command now takes priority over assistant text (slash command fallback pass)
        let msgs: Vec<Option<&str>> = vec![
            Some("/command"),
        ];
        let snippets: Vec<Option<&str>> = vec![
            Some("I'll help you with that"),
        ];
        assert_eq!(
            derive_conversation_title(&msgs, Some(&snippets)),
            Some("/command".to_string())
        );
    }

    #[test]
    fn derive_title_assistant_fallback_no_slash() {
        // When no slash commands exist, assistant text is used as fallback
        let msgs: Vec<Option<&str>> = vec![
            Some("<system>test</system>"),
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

    #[test]
    fn skip_short_message() {
        assert!(should_skip_for_title("4"));
        assert!(should_skip_for_title("ab"));
    }

    #[test]
    fn allow_three_char_message() {
        assert!(!should_skip_for_title("abc"));
    }

    #[test]
    fn derive_title_slash_command_fallback() {
        let msgs: Vec<Option<&str>> = vec![
            Some("/gsd:discuss-phase"),
            Some("4"),
        ];
        assert_eq!(
            derive_conversation_title(&msgs, None),
            Some("/gsd:discuss-phase".to_string())
        );
    }

    #[test]
    fn derive_title_normal_over_slash() {
        let msgs: Vec<Option<&str>> = vec![
            Some("/gsd:discuss-phase"),
            Some("Fix the login bug"),
        ];
        assert_eq!(
            derive_conversation_title(&msgs, None),
            Some("Fix the login bug".to_string())
        );
    }

    #[test]
    fn derive_title_xml_slash_command_skipped() {
        // XML-wrapped /clear command should NOT become a title after tag stripping
        let msgs: Vec<Option<&str>> = vec![
            Some("<command-name>/clear</command-name><command-args>clear</command-args>"),
        ];
        // Without assistant fallback, should return None
        assert_eq!(derive_conversation_title(&msgs, None), None);
    }

    #[test]
    fn derive_title_xml_slash_command_falls_to_assistant() {
        // When only message is XML slash command, title falls through to assistant text
        let msgs: Vec<Option<&str>> = vec![
            Some("<command-name>/clear</command-name><command-args>clear</command-args>"),
        ];
        let snippets: Vec<Option<&str>> = vec![
            Some("Context has been cleared"),
        ];
        assert_eq!(
            derive_conversation_title(&msgs, Some(&snippets)),
            Some("Context has been cleared".to_string())
        );
    }

    #[test]
    fn skip_skill_definition() {
        assert!(should_skip_for_title("Base directory for this skill: /Users/sin-ce/.claude/skills/research # Parallel Research"));
    }

    #[test]
    fn skip_skill_prompt_with_objective() {
        assert!(should_skip_for_title("Some text\n<objective>Do something</objective>"));
    }

    #[test]
    fn skip_skill_prompt_with_execution_context() {
        assert!(should_skip_for_title("Run this task\n<execution_context>@some-file</execution_context>"));
    }

    #[test]
    fn skip_skill_prompt_with_files_to_read() {
        assert!(should_skip_for_title("Please read\n<files_to_read>\n- file.txt\n</files_to_read>"));
    }

    #[test]
    fn derive_title_skips_skill_definition() {
        let msgs: Vec<Option<&str>> = vec![
            Some("Base directory for this skill: /Users/foo/.claude/skills/research # Research"),
            Some("Help me understand Rust lifetimes"),
        ];
        assert_eq!(
            derive_conversation_title(&msgs, None),
            Some("Help me understand Rust lifetimes".to_string())
        );
    }

    #[test]
    fn derive_title_xml_slash_command_with_args() {
        let msgs: Vec<Option<&str>> = vec![
            Some("<command-name>/gsd:quick</command-name><command-args>How are plans extracted from conversations?</command-args>"),
        ];
        assert_eq!(
            derive_conversation_title(&msgs, None),
            Some("How are plans extracted from conversations?".to_string())
        );
    }

    #[test]
    fn extract_args_from_slash_command() {
        assert_eq!(
            extract_slash_command_args("/gsd:quick How are plans extracted?"),
            Some("How are plans extracted?".to_string())
        );
    }

    #[test]
    fn extract_args_short_returns_none() {
        assert_eq!(extract_slash_command_args("/clear clear"), None);
    }

    #[test]
    fn extract_args_no_args_returns_none() {
        assert_eq!(extract_slash_command_args("/gsd:discuss-phase"), None);
    }

    #[test]
    fn skip_image_only_message() {
        assert!(should_skip_for_title("[Image: source: /Users/sachin/.claude/image-cache/abc123/5.png]"));
    }

    #[test]
    fn derive_title_strips_image_ref() {
        let msgs: Vec<Option<&str>> = vec![
            Some("[Image: source: /path/to/file.png] Fix the login bug please"),
        ];
        assert_eq!(
            derive_conversation_title(&msgs, None),
            Some("Fix the login bug please".to_string())
        );
    }

    #[test]
    fn derive_title_image_only_falls_through() {
        let msgs: Vec<Option<&str>> = vec![
            Some("[Image: source: /path/to/file.png]"),
            Some("Fix the login bug"),
        ];
        assert_eq!(
            derive_conversation_title(&msgs, None),
            Some("Fix the login bug".to_string())
        );
    }

    #[test]
    fn strip_image_refs_preserves_text() {
        assert_eq!(
            strip_image_refs("[Image: source: /path/file.png] Hello world"),
            "Hello world"
        );
    }

    #[test]
    fn strip_image_refs_empty_when_image_only() {
        assert_eq!(
            strip_image_refs("[Image: source: /path/file.png]"),
            ""
        );
    }

    // ── is_clear_command tests ──────────────────────────────────────────

    #[test]
    fn is_clear_plain() {
        assert!(is_clear_command("/clear"));
    }

    #[test]
    fn clear_command_with_newline() {
        assert!(is_clear_command("/clear\n"));
    }

    #[test]
    fn clear_command_with_whitespace() {
        assert!(is_clear_command("  /clear  "));
    }

    #[test]
    fn clear_command_with_args_is_not_clear() {
        assert!(!is_clear_command("/clear with args"));
    }

    #[test]
    fn clear_command_not_a_clear() {
        assert!(!is_clear_command("not a clear"));
    }

    #[test]
    fn clear_command_xml_format() {
        assert!(is_clear_command("<command-name>/clear</command-name>"));
    }

    #[test]
    fn clear_command_xml_with_args() {
        assert!(is_clear_command("<command-name>/clear</command-name><command-args>clear</command-args>"));
    }

    // ── strip_image_refs [Image #N] tests ───────────────────────────────

    #[test]
    fn strip_image_refs_numbered() {
        assert_eq!(strip_image_refs("[Image #1] Fix the bug"), "Fix the bug");
    }

    #[test]
    fn strip_image_refs_multiple_numbered() {
        assert_eq!(strip_image_refs("[Image #12] [Image #3] text"), "text");
    }

    #[test]
    fn strip_image_refs_source_still_works() {
        assert_eq!(
            strip_image_refs("[Image: source: /path.png] text"),
            "text"
        );
    }

    // ── derive_conversation_title /clear-aware tests ────────────────────

    #[test]
    fn derive_title_after_clear() {
        let msgs: Vec<Option<&str>> = vec![Some("/clear"), Some("Fix bug")];
        assert_eq!(
            derive_conversation_title(&msgs, None),
            Some("Fix bug".to_string())
        );
    }

    #[test]
    fn derive_title_after_clear_with_preceding() {
        let msgs: Vec<Option<&str>> = vec![Some("Hello"), Some("/clear"), Some("New topic")];
        assert_eq!(
            derive_conversation_title(&msgs, None),
            Some("New topic".to_string())
        );
    }

    #[test]
    fn derive_title_clear_only_returns_none() {
        let msgs: Vec<Option<&str>> = vec![Some("/clear")];
        assert_eq!(derive_conversation_title(&msgs, None), None);
    }

    #[test]
    fn derive_title_multiple_clears_uses_last() {
        let msgs: Vec<Option<&str>> = vec![
            Some("/clear"),
            Some("/clear"),
            Some("Final topic"),
        ];
        assert_eq!(
            derive_conversation_title(&msgs, None),
            Some("Final topic".to_string())
        );
    }
}
