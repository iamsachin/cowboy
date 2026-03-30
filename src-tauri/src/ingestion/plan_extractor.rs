use std::collections::HashSet;
use std::sync::LazyLock;

use regex::Regex;

use super::types::ToolCallRecord;

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

// ── Regex patterns for plan markdown parsing ──────────────────────────────

static NUMBERED_STEP_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"^\s*(\d+)[.)]\s+(.+)$").unwrap());

static CHECKBOX_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"^\s*-\s*\[([ xX])\]\s+(.+)$").unwrap());

static TABLE_ROW_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"^\|\s*(\d+)\s*\|(.+)").unwrap());

static H1_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"^#\s+(.+)$").unwrap());

static PLAN_PREFIX_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"(?i)^plan:\s*").unwrap());

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

// ── Extract title from plan markdown ──────────────────────────────────────

fn extract_title(plan_markdown: &str, conversation_title: Option<&str>) -> String {
    // Find first H1 heading
    for line in plan_markdown.lines() {
        let trimmed = line.trim();
        if let Some(caps) = H1_RE.captures(trimmed) {
            let raw_title = caps.get(1).unwrap().as_str().trim();
            // Strip "Plan:" prefix if present
            let title = PLAN_PREFIX_RE.replace(raw_title, "").trim().to_string();
            if !title.is_empty() {
                return clean_markdown(&title);
            }
        }
    }

    // Fallback: conversation title
    if let Some(title) = conversation_title {
        let t = title.trim();
        if !t.is_empty() {
            return clean_markdown(t);
        }
    }

    // Final fallback
    "Plan".to_string()
}

// ── Extract steps from plan markdown ──────────────────────────────────────

fn extract_steps(plan_markdown: &str) -> Vec<ExtractedStep> {
    let mut steps: Vec<ExtractedStep> = Vec::new();

    for line in plan_markdown.lines() {
        let trimmed = line.trim();

        // Try checkbox first (most specific)
        if let Some(caps) = CHECKBOX_RE.captures(trimmed) {
            let check_char = caps.get(1).unwrap().as_str();
            let content = caps.get(2).unwrap().as_str().trim().to_string();
            steps.push(ExtractedStep {
                step_number: steps.len() + 1,
                content,
                is_checked: Some(check_char.to_lowercase() == "x"),
            });
            continue;
        }

        // Try numbered list
        if let Some(caps) = NUMBERED_STEP_RE.captures(trimmed) {
            let step_num: usize = caps.get(1).unwrap().as_str().parse().unwrap_or(steps.len() + 1);
            let content = caps.get(2).unwrap().as_str().trim().to_string();
            steps.push(ExtractedStep {
                step_number: step_num,
                content,
                is_checked: None,
            });
            continue;
        }

        // Try table row
        if let Some(caps) = TABLE_ROW_RE.captures(trimmed) {
            let step_num: usize = caps.get(1).unwrap().as_str().trim().parse().unwrap_or(steps.len() + 1);
            let rest = caps.get(2).unwrap().as_str();
            // Split remaining columns by |, combine non-empty ones
            let cols: Vec<&str> = rest.split('|')
                .map(|c| c.trim())
                .filter(|c| !c.is_empty() && *c != "---" && !c.starts_with(':'))
                .collect();
            let content = cols.join(" - ");
            if !content.is_empty() {
                steps.push(ExtractedStep {
                    step_number: step_num,
                    content,
                    is_checked: None,
                });
            }
        }
    }

    steps
}

// ── Main extraction function ───────────────────────────────────────────────

/// Extract plans from ExitPlanMode tool calls.
/// This is the only source of plans -- no heuristic content scanning.
pub fn extract_plans_from_tool_calls(
    tool_calls: &[ToolCallRecord],
    conversation_title: Option<&str>,
) -> Vec<ExtractedPlan> {
    let mut plans: Vec<ExtractedPlan> = Vec::new();

    for tc in tool_calls {
        if tc.name != "ExitPlanMode" {
            continue;
        }

        // Parse input to get the plan field
        let plan_markdown = match tc.input.get("plan").and_then(|v| v.as_str()) {
            Some(p) => p,
            None => continue,
        };

        let title = extract_title(plan_markdown, conversation_title);
        let mut steps = extract_steps(plan_markdown);

        // If no steps found (purely prose plan), create a single step from the text
        if steps.is_empty() {
            let truncated = if plan_markdown.len() > 500 {
                format!("{}...", &plan_markdown[..497])
            } else {
                plan_markdown.to_string()
            };
            steps.push(ExtractedStep {
                step_number: 1,
                content: truncated,
                is_checked: None,
            });
        }

        plans.push(ExtractedPlan {
            title,
            source_message_id: tc.message_id.clone(),
            steps,
        });
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

    // ── Helper to create a ToolCallRecord for ExitPlanMode ───────────────

    fn exit_plan_mode_tc(plan: &str, message_id: &str) -> ToolCallRecord {
        ToolCallRecord {
            id: format!("tc-{}", message_id),
            message_id: message_id.to_string(),
            conversation_id: "conv-001".to_string(),
            name: "ExitPlanMode".to_string(),
            input: serde_json::json!({ "plan": plan }),
            output: None,
            status: Some("success".to_string()),
            duration: None,
            created_at: "2026-01-01T00:00:00Z".to_string(),
        }
    }

    fn other_tool_tc(name: &str, message_id: &str) -> ToolCallRecord {
        ToolCallRecord {
            id: format!("tc-{}", message_id),
            message_id: message_id.to_string(),
            conversation_id: "conv-001".to_string(),
            name: name.to_string(),
            input: serde_json::json!({}),
            output: None,
            status: Some("success".to_string()),
            duration: None,
            created_at: "2026-01-01T00:00:00Z".to_string(),
        }
    }

    // ── ExitPlanMode with numbered steps ──────────────────────────────────

    #[test]
    fn extract_numbered_steps_from_exit_plan_mode() {
        let plan = "# Plan: Database Migration\n\n1. Create the schema\n2. Add migration scripts\n3. Update API routes\n4. Test endpoints";
        let tool_calls = vec![exit_plan_mode_tc(plan, "msg-001")];
        let plans = extract_plans_from_tool_calls(&tool_calls, None);
        assert_eq!(plans.len(), 1);
        assert_eq!(plans[0].title, "Database Migration");
        assert_eq!(plans[0].steps.len(), 4);
        assert_eq!(plans[0].steps[0].step_number, 1);
        assert_eq!(plans[0].steps[0].content, "Create the schema");
        assert_eq!(plans[0].source_message_id, "msg-001");
    }

    // ── ExitPlanMode with markdown table ──────────────────────────────────

    #[test]
    fn extract_table_rows_from_exit_plan_mode() {
        let plan = "# Implementation Plan\n\n| Step | File | Description |\n|------|------|-------------|\n| 1 | src/main.rs | Add entry point |\n| 2 | src/lib.rs | Create library module |\n| 3 | tests/test.rs | Add integration tests |";
        let tool_calls = vec![exit_plan_mode_tc(plan, "msg-002")];
        let plans = extract_plans_from_tool_calls(&tool_calls, None);
        assert_eq!(plans.len(), 1);
        assert_eq!(plans[0].title, "Implementation Plan");
        assert_eq!(plans[0].steps.len(), 3);
        assert_eq!(plans[0].steps[0].step_number, 1);
        assert!(plans[0].steps[0].content.contains("src/main.rs"));
        assert!(plans[0].steps[0].content.contains("Add entry point"));
    }

    // ── ExitPlanMode with checkbox list ───────────────────────────────────

    #[test]
    fn extract_checkboxes_from_exit_plan_mode() {
        let plan = "# Deployment Checklist\n\n- [x] Build the project\n- [ ] Run tests\n- [X] Update config\n- [ ] Deploy to staging";
        let tool_calls = vec![exit_plan_mode_tc(plan, "msg-003")];
        let plans = extract_plans_from_tool_calls(&tool_calls, None);
        assert_eq!(plans.len(), 1);
        assert_eq!(plans[0].title, "Deployment Checklist");
        assert_eq!(plans[0].steps.len(), 4);
        assert_eq!(plans[0].steps[0].is_checked, Some(true));
        assert_eq!(plans[0].steps[1].is_checked, Some(false));
        assert_eq!(plans[0].steps[2].is_checked, Some(true));
        assert_eq!(plans[0].steps[3].is_checked, Some(false));
    }

    // ── Title extracted from first H1 heading ─────────────────────────────

    #[test]
    fn title_from_h1_heading() {
        let plan = "# My Custom Title\n\n1. Step one\n2. Step two\n3. Step three";
        let tool_calls = vec![exit_plan_mode_tc(plan, "msg-004")];
        let plans = extract_plans_from_tool_calls(&tool_calls, Some("Conversation Title"));
        assert_eq!(plans[0].title, "My Custom Title");
    }

    #[test]
    fn title_strips_plan_prefix() {
        let plan = "# Plan: Setup Environment\n\n1. Install deps\n2. Configure tooling\n3. Run setup";
        let tool_calls = vec![exit_plan_mode_tc(plan, "msg-005")];
        let plans = extract_plans_from_tool_calls(&tool_calls, None);
        assert_eq!(plans[0].title, "Setup Environment");
    }

    #[test]
    fn title_falls_back_to_conversation_title() {
        let plan = "Some prose without a heading.\n\n1. Do thing A\n2. Do thing B\n3. Do thing C";
        let tool_calls = vec![exit_plan_mode_tc(plan, "msg-006")];
        let plans = extract_plans_from_tool_calls(&tool_calls, Some("My Conversation"));
        assert_eq!(plans[0].title, "My Conversation");
    }

    #[test]
    fn title_falls_back_to_default() {
        let plan = "Some prose without a heading.\n\n1. Do thing A\n2. Do thing B\n3. Do thing C";
        let tool_calls = vec![exit_plan_mode_tc(plan, "msg-007")];
        let plans = extract_plans_from_tool_calls(&tool_calls, None);
        assert_eq!(plans[0].title, "Plan");
    }

    // ── Non-ExitPlanMode tool calls are ignored ───────────────────────────

    #[test]
    fn non_exit_plan_mode_ignored() {
        let tool_calls = vec![
            other_tool_tc("Write", "msg-010"),
            other_tool_tc("Read", "msg-011"),
            other_tool_tc("EnterPlanMode", "msg-012"),
        ];
        let plans = extract_plans_from_tool_calls(&tool_calls, None);
        assert_eq!(plans.len(), 0);
    }

    // ── ExitPlanMode with no parseable steps creates single-step plan ─────

    #[test]
    fn prose_plan_creates_single_step() {
        let plan = "# Refactoring Strategy\n\nWe need to carefully restructure the codebase to improve maintainability. The key insight is that modules should be more loosely coupled.";
        let tool_calls = vec![exit_plan_mode_tc(plan, "msg-020")];
        let plans = extract_plans_from_tool_calls(&tool_calls, None);
        assert_eq!(plans.len(), 1);
        assert_eq!(plans[0].title, "Refactoring Strategy");
        assert_eq!(plans[0].steps.len(), 1);
        assert!(plans[0].steps[0].content.contains("Refactoring Strategy"));
    }

    // ── Multiple ExitPlanMode calls produce multiple plans ────────────────

    #[test]
    fn multiple_exit_plan_mode_calls() {
        let plan1 = "# Plan A\n\n1. Step A1\n2. Step A2\n3. Step A3";
        let plan2 = "# Plan B\n\n- [x] Task B1\n- [ ] Task B2\n- [ ] Task B3";
        let tool_calls = vec![
            exit_plan_mode_tc(plan1, "msg-030"),
            other_tool_tc("Write", "msg-031"),
            exit_plan_mode_tc(plan2, "msg-032"),
        ];
        let plans = extract_plans_from_tool_calls(&tool_calls, None);
        assert_eq!(plans.len(), 2);
        assert_eq!(plans[0].title, "Plan A");
        assert_eq!(plans[1].title, "Plan B");
        assert_eq!(plans[0].source_message_id, "msg-030");
        assert_eq!(plans[1].source_message_id, "msg-032");
    }

    // ── clean_markdown ────────────────────────────────────────────────────

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
