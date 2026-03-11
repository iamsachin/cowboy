use std::collections::HashSet;
use std::sync::LazyLock;

use regex::Regex;

// ── Types ──────────────────────────────────────────────────────────────────

#[derive(Debug, Clone)]
pub struct ExtractedPlan {
    pub title: String,
    pub source_message_id: String,
    pub steps: Vec<ExtractedStep>,
}

#[derive(Debug, Clone)]
pub struct ExtractedStep {
    pub step_number: usize,
    pub content: String,
    pub is_checked: Option<bool>, // None = not a checkbox, Some(true) = [x], Some(false) = [ ]
}

#[derive(Debug, Clone)]
pub struct CompletionContext {
    pub later_messages: Vec<LaterMessage>,
    pub tool_calls: Vec<ToolCallRef>,
}

#[derive(Debug, Clone)]
pub struct LaterMessage {
    pub role: String,
    pub content: Option<String>,
}

#[derive(Debug, Clone)]
pub struct ToolCallRef {
    pub name: String,
    pub input: serde_json::Value,
    pub status: Option<String>,
}

// ── Regex patterns ─────────────────────────────────────────────────────────

static NUMBERED_STEP_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"^\s*(\d+)[.)]\s+(.+)$").unwrap());

static CHECKBOX_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"^\s*-\s*\[([ xX])\]\s+(.+)$").unwrap());

static EXPLICIT_STEP_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"^\s*[Ss]tep\s+(\d+)[:.]\s*(.+)$").unwrap());

// ── Action verb set ────────────────────────────────────────────────────────

static ACTION_VERBS: LazyLock<HashSet<&'static str>> = LazyLock::new(|| {
    let verbs = [
        "create", "add", "update", "delete", "remove", "write", "read",
        "run", "execute", "install", "configure", "set", "build", "deploy",
        "test", "fix", "implement", "modify", "change", "move", "copy",
        "rename", "open", "close", "check", "verify", "ensure", "define",
        "export", "import", "refactor", "migrate", "merge", "push", "pull",
        "commit", "start", "stop", "restart", "replace", "insert", "edit",
        "wrap", "extract", "split", "combine", "connect", "disconnect",
        "enable", "disable", "register", "unregister", "initialize", "setup",
    ];
    verbs.into_iter().collect()
});

fn has_action_verb(step_content: &str) -> bool {
    let first_word = step_content
        .trim()
        .split_whitespace()
        .next()
        .unwrap_or("")
        .to_lowercase();
    ACTION_VERBS.contains(first_word.as_str())
}

// ── Pattern type ───────────────────────────────────────────────────────────

#[derive(Debug, Clone, Copy, PartialEq)]
enum PatternType {
    Numbered,
    Checkbox,
    Explicit,
}

#[derive(Debug, Clone)]
struct ParsedLine {
    pattern_type: PatternType,
    step_number: usize,
    content: String,
    is_checked: Option<bool>,
}

fn parse_line(line: &str) -> Option<ParsedLine> {
    // Try checkbox first (most specific)
    if let Some(caps) = CHECKBOX_RE.captures(line) {
        let check_char = caps.get(1).unwrap().as_str();
        let content = caps.get(2).unwrap().as_str().trim().to_string();
        return Some(ParsedLine {
            pattern_type: PatternType::Checkbox,
            step_number: 0, // assigned later
            content,
            is_checked: Some(check_char.to_lowercase() == "x"),
        });
    }

    // Try explicit step pattern
    if let Some(caps) = EXPLICIT_STEP_RE.captures(line) {
        let step_num: usize = caps.get(1).unwrap().as_str().parse().unwrap_or(0);
        let content = caps.get(2).unwrap().as_str().trim().to_string();
        return Some(ParsedLine {
            pattern_type: PatternType::Explicit,
            step_number: step_num,
            content,
            is_checked: None,
        });
    }

    // Try numbered list pattern
    if let Some(caps) = NUMBERED_STEP_RE.captures(line) {
        let step_num: usize = caps.get(1).unwrap().as_str().parse().unwrap_or(0);
        let content = caps.get(2).unwrap().as_str().trim().to_string();
        return Some(ParsedLine {
            pattern_type: PatternType::Numbered,
            step_number: step_num,
            content,
            is_checked: None,
        });
    }

    None
}

// ── Markdown cleaning ──────────────────────────────────────────────────────

static HEADING_RE: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"^#{1,6}\s+").unwrap());
static BOLD_RE: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"\*\*(.+?)\*\*").unwrap());
static UNDERSCORE_BOLD_RE: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"__(.+?)__").unwrap());
static ITALIC_RE: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"\*(.+?)\*").unwrap());
static UNDERSCORE_ITALIC_RE: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"_(.+?)_").unwrap());
static BACKTICK_RE: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"`(.+?)`").unwrap());

pub fn clean_markdown(text: &str) -> String {
    let mut cleaned = HEADING_RE.replace(text, "").to_string();
    cleaned = BOLD_RE.replace_all(&cleaned, "$1").to_string();
    cleaned = UNDERSCORE_BOLD_RE.replace_all(&cleaned, "$1").to_string();
    cleaned = ITALIC_RE.replace_all(&cleaned, "$1").to_string();
    cleaned = UNDERSCORE_ITALIC_RE.replace_all(&cleaned, "$1").to_string();
    cleaned = BACKTICK_RE.replace_all(&cleaned, "$1").to_string();
    cleaned.trim().to_string()
}

// ── Title inference ────────────────────────────────────────────────────────

fn infer_title(
    preceding_lines: &[&str],
    first_step_content: &str,
    conversation_title: Option<&str>,
) -> String {
    // Look backwards for a short non-empty line that looks like a heading
    for line in preceding_lines.iter().rev() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }
        // Short line (<80 chars), not ending with a period (unless colon)
        if trimmed.len() < 80 && (trimmed.ends_with(':') || !trimmed.ends_with('.')) {
            let raw = if trimmed.ends_with(':') {
                trimmed[..trimmed.len() - 1].trim()
            } else {
                trimmed
            };
            return clean_markdown(raw);
        }
        break; // Stop at first non-empty non-qualifying line
    }

    // Fallback 1: conversation title
    if let Some(title) = conversation_title {
        let t = title.trim();
        if !t.is_empty() {
            return clean_markdown(t);
        }
    }

    // Fallback 2: truncated first step content
    let cleaned = clean_markdown(first_step_content);
    if cleaned.len() > 80 {
        format!("{}...", &cleaned[..77])
    } else {
        cleaned
    }
}

// ── Main extraction function ───────────────────────────────────────────────

pub fn extract_plans(
    content: &str,
    message_id: &str,
    conversation_title: Option<&str>,
) -> Vec<ExtractedPlan> {
    let lines: Vec<&str> = content.split('\n').collect();
    let mut plans: Vec<ExtractedPlan> = Vec::new();

    let mut current_steps: Vec<ParsedLine> = Vec::new();
    let mut current_type: Option<PatternType> = None;
    let mut list_start_index: usize = 0;

    let mut finalize_plan = |steps: &mut Vec<ParsedLine>,
                             ctype: &mut Option<PatternType>,
                             start_idx: &mut usize,
                             plans: &mut Vec<ExtractedPlan>,
                             lines: &[&str],
                             msg_id: &str,
                             conv_title: Option<&str>| {
        if steps.len() >= 3 {
            // For numbered lists, require action verbs on >50% of steps
            if *ctype == Some(PatternType::Numbered) {
                let action_count = steps.iter().filter(|s| has_action_verb(&s.content)).count();
                if (action_count as f64 / steps.len() as f64) <= 0.5 {
                    steps.clear();
                    *ctype = None;
                    *start_idx = 0;
                    return;
                }
            }

            // Build ExtractedStep vec
            let extracted_steps: Vec<ExtractedStep> = steps
                .iter()
                .enumerate()
                .map(|(i, s)| ExtractedStep {
                    step_number: if s.pattern_type == PatternType::Checkbox {
                        i + 1
                    } else {
                        s.step_number
                    },
                    content: s.content.clone(),
                    is_checked: s.is_checked,
                })
                .collect();

            let preceding = &lines[..*start_idx];
            let title = infer_title(preceding, &extracted_steps[0].content, conv_title);

            plans.push(ExtractedPlan {
                title,
                source_message_id: msg_id.to_string(),
                steps: extracted_steps,
            });
        }

        steps.clear();
        *ctype = None;
        *start_idx = 0;
    };

    for i in 0..lines.len() {
        let line = lines[i];
        let parsed = parse_line(line);

        if let Some(p) = parsed {
            if current_type.is_none() {
                // Starting a new list
                current_type = Some(p.pattern_type);
                current_steps = vec![p];
                list_start_index = i;
            } else if Some(p.pattern_type) == current_type {
                // Number sequence reset detection
                if current_type == Some(PatternType::Numbered) && !current_steps.is_empty() {
                    let prev_step_num = current_steps.last().unwrap().step_number;
                    if p.step_number <= prev_step_num {
                        finalize_plan(
                            &mut current_steps,
                            &mut current_type,
                            &mut list_start_index,
                            &mut plans,
                            &lines,
                            message_id,
                            conversation_title,
                        );
                        current_type = Some(p.pattern_type);
                        current_steps = vec![p];
                        list_start_index = i;
                        continue;
                    }
                }
                current_steps.push(p);
            } else {
                // Different type -- finalize current, start new
                finalize_plan(
                    &mut current_steps,
                    &mut current_type,
                    &mut list_start_index,
                    &mut plans,
                    &lines,
                    message_id,
                    conversation_title,
                );
                current_type = Some(p.pattern_type);
                current_steps = vec![p];
                list_start_index = i;
            }
        } else {
            let trimmed = line.trim();
            if trimmed.is_empty() {
                // Empty line -- allowed within a list, don't break
                continue;
            }

            // Non-empty, non-matching line -- finalize current list if any
            if !current_steps.is_empty() {
                finalize_plan(
                    &mut current_steps,
                    &mut current_type,
                    &mut list_start_index,
                    &mut plans,
                    &lines,
                    message_id,
                    conversation_title,
                );
            }
        }
    }

    // Finalize any remaining list at end of content
    if !current_steps.is_empty() {
        finalize_plan(
            &mut current_steps,
            &mut current_type,
            &mut list_start_index,
            &mut plans,
            &lines,
            message_id,
            conversation_title,
        );
    }

    plans
}

// ── Completion inference engine ────────────────────────────────────────────

static COMPLETION_SIGNALS: LazyLock<Vec<Regex>> = LazyLock::new(|| {
    vec![
        Regex::new(r"(?i)completed?\b").unwrap(),
        Regex::new(r"(?i)done\b").unwrap(),
        Regex::new(r"(?i)finished\b").unwrap(),
        Regex::new(r"(?i)moving to (?:the )?next").unwrap(),
        Regex::new(r"(?i)successfully").unwrap(),
    ]
});

static STOPWORDS: LazyLock<HashSet<&'static str>> = LazyLock::new(|| {
    [
        "the", "and", "for", "with", "from", "into", "that", "this", "then",
        "will", "all", "are", "was", "were", "has", "have", "had",
    ]
    .into_iter()
    .collect()
});

pub fn infer_step_completion(step: &ExtractedStep, context: &CompletionContext) -> &'static str {
    // Priority 1: Checkbox state (highest confidence)
    if step.is_checked == Some(true) {
        return "complete";
    }
    if step.is_checked == Some(false) {
        return "incomplete";
    }

    // Priority 2: Tool call correlation (word boundary matching)
    for tc in &context.tool_calls {
        let escaped = regex::escape(&tc.name);
        if let Ok(tool_regex) = Regex::new(&format!(r"(?i)\b{}\b", escaped)) {
            if tool_regex.is_match(&step.content) {
                if let Some(ref status) = tc.status {
                    if status == "success" || status == "completed" {
                        return "complete";
                    }
                }
            }
        }
    }

    // Priority 3: Text pattern matching in later messages
    let step_lower = step.content.to_lowercase();
    let step_words: Vec<&str> = step_lower
        .split_whitespace()
        .filter(|w| w.len() >= 3 && !STOPWORDS.contains(w))
        .collect();

    let match_threshold = std::cmp::max(2, (step_words.len() as f64 * 0.6).ceil() as usize);

    for msg in &context.later_messages {
        if let Some(ref content) = msg.content {
            let msg_lower = content.to_lowercase();
            let match_count = step_words.iter().filter(|w| msg_lower.contains(*w)).count();
            if match_count >= match_threshold {
                for signal in COMPLETION_SIGNALS.iter() {
                    if signal.is_match(content) {
                        return "complete";
                    }
                }
            }
        }
    }

    // Default: unknown
    "unknown"
}

#[cfg(test)]
mod tests {
    use super::*;

    // ── ACTION_VERBS count ─────────────────────────────────────────────

    #[test]
    fn action_verbs_has_all_51() {
        // The Node.js set has exactly 54 verbs (create through setup)
        // Count them: create add update delete remove write read run execute install
        //   configure set build deploy test fix implement modify change move copy
        //   rename open close check verify ensure define export import refactor
        //   migrate merge push pull commit start stop restart replace insert edit
        //   wrap extract split combine connect disconnect enable disable register
        //   unregister initialize setup = 54
        assert_eq!(ACTION_VERBS.len(), 54);
    }

    // ── extract_plans: numbered list ───────────────────────────────────

    #[test]
    fn extract_numbered_list_plan() {
        let content = "Here's my plan:\n\
                        1. Create the database schema\n\
                        2. Add migration scripts\n\
                        3. Update the API routes\n\
                        4. Test the endpoints";
        let plans = extract_plans(content, "msg-001", None);
        assert_eq!(plans.len(), 1);
        assert_eq!(plans[0].title, "Here's my plan");
        assert_eq!(plans[0].steps.len(), 4);
        assert_eq!(plans[0].steps[0].step_number, 1);
        assert_eq!(plans[0].steps[0].content, "Create the database schema");
        assert_eq!(plans[0].source_message_id, "msg-001");
    }

    // ── extract_plans: checkbox list ───────────────────────────────────

    #[test]
    fn extract_checkbox_list_plan() {
        let content = "Todo list:\n\
                        - [x] Create the file\n\
                        - [ ] Add the handler\n\
                        - [X] Update the tests\n\
                        - [ ] Deploy to staging";
        let plans = extract_plans(content, "msg-002", None);
        assert_eq!(plans.len(), 1);
        assert_eq!(plans[0].title, "Todo list");
        assert_eq!(plans[0].steps.len(), 4);
        // Checkbox step numbers are 1-indexed sequential
        assert_eq!(plans[0].steps[0].step_number, 1);
        assert_eq!(plans[0].steps[0].is_checked, Some(true));
        assert_eq!(plans[0].steps[1].is_checked, Some(false));
        assert_eq!(plans[0].steps[2].is_checked, Some(true)); // X uppercase
        assert_eq!(plans[0].steps[3].is_checked, Some(false));
    }

    // ── extract_plans: explicit step pattern ───────────────────────────

    #[test]
    fn extract_explicit_step_plan() {
        let content = "Implementation approach:\n\
                        Step 1: Create the schema\n\
                        Step 2: Add validation\n\
                        Step 3: Write tests";
        let plans = extract_plans(content, "msg-003", None);
        assert_eq!(plans.len(), 1);
        assert_eq!(plans[0].title, "Implementation approach");
        assert_eq!(plans[0].steps.len(), 3);
        assert_eq!(plans[0].steps[0].step_number, 1);
        assert_eq!(plans[0].steps[0].content, "Create the schema");
    }

    // ── extract_plans: <3 steps returns empty ──────────────────────────

    #[test]
    fn numbered_list_under_3_steps_returns_empty() {
        let content = "Plan:\n1. Create the file\n2. Update the tests";
        let plans = extract_plans(content, "msg-004", None);
        assert_eq!(plans.len(), 0);
    }

    // ── extract_plans: <=50% action verbs returns empty ────────────────

    #[test]
    fn numbered_list_low_action_verbs_returns_empty() {
        let content = "Some list:\n\
                        1. Apple pie recipe\n\
                        2. Banana bread ingredients\n\
                        3. Cherry tart filling\n\
                        4. Donut glaze mixture";
        let plans = extract_plans(content, "msg-005", None);
        assert_eq!(plans.len(), 0);
    }

    // ── Number sequence reset splits into two plans ────────────────────

    #[test]
    fn number_reset_splits_into_two_plans() {
        let content = "First plan:\n\
                        1. Create the database\n\
                        2. Add the migration\n\
                        3. Update the schema\n\
                        \n\
                        Second plan:\n\
                        1. Build the frontend\n\
                        2. Deploy the app\n\
                        3. Test the endpoints";
        let plans = extract_plans(content, "msg-006", None);
        assert_eq!(plans.len(), 2);
        assert_eq!(plans[0].title, "First plan");
        assert_eq!(plans[1].title, "Second plan");
    }

    // ── Title inference: conversation title fallback ────────────────────

    #[test]
    fn title_fallback_to_conversation_title() {
        // No preceding short line, provide conversation title
        let content = "1. Create the schema\n\
                        2. Add validation\n\
                        3. Write tests";
        let plans = extract_plans(content, "msg-007", Some("My Project Setup"));
        assert_eq!(plans.len(), 1);
        assert_eq!(plans[0].title, "My Project Setup");
    }

    // ── Title inference: first step fallback ────────────────────────────

    #[test]
    fn title_fallback_to_first_step() {
        let content = "1. Create the schema for the big project\n\
                        2. Add validation logic\n\
                        3. Write comprehensive tests";
        let plans = extract_plans(content, "msg-008", None);
        assert_eq!(plans.len(), 1);
        assert_eq!(plans[0].title, "Create the schema for the big project");
    }

    // ── clean_markdown ─────────────────────────────────────────────────

    #[test]
    fn clean_markdown_strips_formatting() {
        assert_eq!(clean_markdown("## My Heading"), "My Heading");
        assert_eq!(clean_markdown("**bold text**"), "bold text");
        assert_eq!(clean_markdown("*italic text*"), "italic text");
        assert_eq!(clean_markdown("`code snippet`"), "code snippet");
        assert_eq!(clean_markdown("__underline bold__"), "underline bold");
    }

    // ── infer_step_completion: checkbox ─────────────────────────────────

    #[test]
    fn completion_checked_checkbox() {
        let step = ExtractedStep {
            step_number: 1,
            content: "Create the file".to_string(),
            is_checked: Some(true),
        };
        let ctx = CompletionContext {
            later_messages: vec![],
            tool_calls: vec![],
        };
        assert_eq!(infer_step_completion(&step, &ctx), "complete");
    }

    #[test]
    fn completion_unchecked_checkbox() {
        let step = ExtractedStep {
            step_number: 1,
            content: "Create the file".to_string(),
            is_checked: Some(false),
        };
        let ctx = CompletionContext {
            later_messages: vec![],
            tool_calls: vec![],
        };
        assert_eq!(infer_step_completion(&step, &ctx), "incomplete");
    }

    // ── infer_step_completion: tool call ────────────────────────────────

    #[test]
    fn completion_tool_call_match() {
        let step = ExtractedStep {
            step_number: 1,
            content: "Run the Write tool to create the file".to_string(),
            is_checked: None,
        };
        let ctx = CompletionContext {
            later_messages: vec![],
            tool_calls: vec![ToolCallRef {
                name: "Write".to_string(),
                input: serde_json::Value::Null,
                status: Some("success".to_string()),
            }],
        };
        assert_eq!(infer_step_completion(&step, &ctx), "complete");
    }

    // ── infer_step_completion: default unknown ─────────────────────────

    #[test]
    fn completion_default_unknown() {
        let step = ExtractedStep {
            step_number: 1,
            content: "Create the file".to_string(),
            is_checked: None,
        };
        let ctx = CompletionContext {
            later_messages: vec![],
            tool_calls: vec![],
        };
        assert_eq!(infer_step_completion(&step, &ctx), "unknown");
    }

    // ── infer_step_completion: text pattern ─────────────────────────────

    #[test]
    fn completion_text_pattern_match() {
        let step = ExtractedStep {
            step_number: 1,
            content: "Create the database schema migration".to_string(),
            is_checked: None,
        };
        let ctx = CompletionContext {
            later_messages: vec![LaterMessage {
                role: "assistant".to_string(),
                content: Some(
                    "I've successfully created the database schema migration files."
                        .to_string(),
                ),
            }],
            tool_calls: vec![],
        };
        assert_eq!(infer_step_completion(&step, &ctx), "complete");
    }
}
