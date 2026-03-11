use std::collections::{HashMap, HashSet};
use std::sync::LazyLock;

use regex::Regex;

use super::types::DiscoveredFile;

// ── agentId extraction ─────────────────────────────────────────────────────

static AGENT_ID_REGEX: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"agentId:\s*([a-f0-9]+)").unwrap());

/// Extract the agentId from a tool_result output string.
/// Returns None if not found or input is empty.
pub fn extract_agent_id(output: &str) -> Option<String> {
    AGENT_ID_REGEX
        .captures(output)
        .and_then(|caps| caps.get(1))
        .map(|m| m.as_str().to_string())
}

// ── Types ──────────────────────────────────────────────────────────────────

#[derive(Debug, Clone)]
pub struct ToolCallInfo {
    pub id: String,
    pub name: String,
    pub input: serde_json::Value,
    pub output: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, PartialEq)]
pub struct SubagentLink {
    pub tool_call_id: String,
    pub subagent_conversation_id: String,
    pub parent_conversation_id: String,
    pub match_confidence: MatchConfidence,
}

#[derive(Debug, Clone, PartialEq)]
pub enum MatchConfidence {
    High,
    Medium,
    Low,
}

impl MatchConfidence {
    pub fn as_str(&self) -> &'static str {
        match self {
            MatchConfidence::High => "high",
            MatchConfidence::Medium => "medium",
            MatchConfidence::Low => "low",
        }
    }
}

// ── Tool call name filter ──────────────────────────────────────────────────

static SUBAGENT_TOOL_NAMES: LazyLock<HashSet<&'static str>> =
    LazyLock::new(|| ["Task", "Agent"].into_iter().collect());

// ── Main linking algorithm ─────────────────────────────────────────────────

/// Three-phase matching algorithm to link subagent files to parent tool calls.
///
/// Phase 1 (agentId - HIGH): Extract agentId from tool output, match to subagent sessionId.
/// Phase 2 (description - MEDIUM): Compare tool call input.description to subagent first user message.
/// Phase 3 (positional - LOW): Match by timestamp order as last resort.
pub fn link_subagents<F1, F2, F3>(
    parent_files: &[DiscoveredFile],
    subagent_files: &[DiscoveredFile],
    get_tool_calls: &F1,
    get_conversation_id: &F2,
    get_first_user_message: Option<&F3>,
) -> Vec<SubagentLink>
where
    F1: Fn(&str) -> Vec<ToolCallInfo>,
    F2: Fn(&str) -> Option<String>,
    F3: Fn(&str) -> Option<String>,
{
    let mut results: Vec<SubagentLink> = Vec::new();

    // Filter out acompact- prefixed subagent files (background compaction agents)
    let valid_subagent_files: Vec<&DiscoveredFile> = subagent_files
        .iter()
        .filter(|f| !f.session_id.starts_with("acompact"))
        .collect();

    // Build sessionId -> subagent file lookup
    let subagent_by_session_id: HashMap<&str, &DiscoveredFile> = valid_subagent_files
        .iter()
        .map(|f| (f.session_id.as_str(), *f))
        .collect();

    // Track matched items
    let mut matched_subagent_session_ids: HashSet<String> = HashSet::new();
    let mut matched_tool_call_ids: HashSet<String> = HashSet::new();

    for parent_file in parent_files {
        let parent_conv_id = match get_conversation_id(&parent_file.session_id) {
            Some(id) => id,
            None => continue,
        };

        let tool_calls_list = get_tool_calls(&parent_conv_id);
        let agent_tool_calls: Vec<&ToolCallInfo> = tool_calls_list
            .iter()
            .filter(|tc| SUBAGENT_TOOL_NAMES.contains(tc.name.as_str()))
            .collect();

        // ── Phase 1: agentId matching (HIGH confidence) ────────────────

        for tc in &agent_tool_calls {
            if matched_tool_call_ids.contains(&tc.id) {
                continue;
            }

            let agent_id = tc
                .output
                .as_deref()
                .and_then(extract_agent_id);

            let agent_id = match agent_id {
                Some(id) => id,
                None => continue,
            };

            if !subagent_by_session_id.contains_key(agent_id.as_str())
                || matched_subagent_session_ids.contains(&agent_id)
            {
                continue;
            }

            let subagent_conv_id = match get_conversation_id(&agent_id) {
                Some(id) => id,
                None => continue,
            };

            results.push(SubagentLink {
                tool_call_id: tc.id.clone(),
                subagent_conversation_id: subagent_conv_id,
                parent_conversation_id: parent_conv_id.clone(),
                match_confidence: MatchConfidence::High,
            });

            matched_tool_call_ids.insert(tc.id.clone());
            matched_subagent_session_ids.insert(agent_id);
        }

        // ── Phase 2: description matching (MEDIUM confidence) ──────────

        if let Some(get_first_msg) = get_first_user_message {
            let unmatched_tool_calls: Vec<&&ToolCallInfo> = agent_tool_calls
                .iter()
                .filter(|tc| !matched_tool_call_ids.contains(&tc.id))
                .collect();
            let unmatched_subagents: Vec<&&DiscoveredFile> = valid_subagent_files
                .iter()
                .filter(|sf| !matched_subagent_session_ids.contains(&sf.session_id))
                .collect();

            for tc in &unmatched_tool_calls {
                let description = tc
                    .input
                    .get("description")
                    .and_then(|v| v.as_str())
                    .or_else(|| tc.input.get("prompt").and_then(|v| v.as_str()))
                    .unwrap_or("");

                if description.is_empty() {
                    continue;
                }

                let desc_first_line = description.split('\n').next().unwrap_or("").trim();
                if desc_first_line.is_empty() {
                    continue;
                }

                for sf in &unmatched_subagents {
                    if matched_subagent_session_ids.contains(&sf.session_id) {
                        continue;
                    }

                    let subagent_conv_id = match get_conversation_id(&sf.session_id) {
                        Some(id) => id,
                        None => continue,
                    };

                    let first_msg = match get_first_msg(&subagent_conv_id) {
                        Some(msg) => msg,
                        None => continue,
                    };

                    let first_msg_first_line = first_msg.split('\n').next().unwrap_or("").trim();

                    if desc_first_line == first_msg_first_line
                        || first_msg_first_line.starts_with(desc_first_line)
                    {
                        results.push(SubagentLink {
                            tool_call_id: tc.id.clone(),
                            subagent_conversation_id: subagent_conv_id,
                            parent_conversation_id: parent_conv_id.clone(),
                            match_confidence: MatchConfidence::Medium,
                        });

                        matched_tool_call_ids.insert(tc.id.clone());
                        matched_subagent_session_ids.insert(sf.session_id.clone());
                        break;
                    }
                }
            }
        }

        // ── Phase 3: positional matching (LOW confidence) ──────────────

        let mut remaining_tool_calls: Vec<&&ToolCallInfo> = agent_tool_calls
            .iter()
            .filter(|tc| !matched_tool_call_ids.contains(&tc.id))
            .collect();
        remaining_tool_calls.sort_by(|a, b| a.created_at.cmp(&b.created_at));

        let remaining_subagents: Vec<&&DiscoveredFile> = valid_subagent_files
            .iter()
            .filter(|sf| !matched_subagent_session_ids.contains(&sf.session_id))
            .collect();

        let match_count = std::cmp::min(remaining_tool_calls.len(), remaining_subagents.len());
        for i in 0..match_count {
            let tc = remaining_tool_calls[i];
            let sf = remaining_subagents[i];

            let subagent_conv_id = match get_conversation_id(&sf.session_id) {
                Some(id) => id,
                None => continue,
            };

            results.push(SubagentLink {
                tool_call_id: tc.id.clone(),
                subagent_conversation_id: subagent_conv_id,
                parent_conversation_id: parent_conv_id.clone(),
                match_confidence: MatchConfidence::Low,
            });

            matched_tool_call_ids.insert(tc.id.clone());
            matched_subagent_session_ids.insert(sf.session_id.clone());
        }
    }

    results
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extract_agent_id_from_output() {
        assert_eq!(
            extract_agent_id("agentId: abc123"),
            Some("abc123".to_string())
        );
    }

    #[test]
    fn extract_agent_id_no_match() {
        assert_eq!(extract_agent_id("no agent id here"), None);
    }

    #[test]
    fn extract_agent_id_with_whitespace() {
        assert_eq!(
            extract_agent_id("result: ok\nagentId: def456\ndone"),
            Some("def456".to_string())
        );
    }

    #[test]
    fn phase1_agent_id_high_confidence() {
        let parent_files = vec![DiscoveredFile {
            file_path: "/parent/session.jsonl".to_string(),
            project_dir: "/project".to_string(),
            is_subagent: false,
            session_id: "parent-sess".to_string(),
            parent_session_id: None,
        }];
        let subagent_files = vec![DiscoveredFile {
            file_path: "/sub/abc123.jsonl".to_string(),
            project_dir: "/project".to_string(),
            is_subagent: true,
            session_id: "abc123".to_string(),
            parent_session_id: Some("parent-sess".to_string()),
        }];

        let get_tool_calls = |_conv_id: &str| -> Vec<ToolCallInfo> {
            vec![ToolCallInfo {
                id: "tc-001".to_string(),
                name: "Task".to_string(),
                input: serde_json::json!({}),
                output: Some("agentId: abc123".to_string()),
                created_at: "2024-01-01T10:00:00Z".to_string(),
            }]
        };
        let get_conv_id = |session_id: &str| -> Option<String> {
            Some(format!("conv-{}", session_id))
        };
        let get_first_msg = |_conv_id: &str| -> Option<String> { None };

        let results = link_subagents(
            &parent_files,
            &subagent_files,
            &get_tool_calls,
            &get_conv_id,
            Some(&get_first_msg),
        );

        assert_eq!(results.len(), 1);
        assert_eq!(results[0].tool_call_id, "tc-001");
        assert_eq!(results[0].subagent_conversation_id, "conv-abc123");
        assert_eq!(results[0].parent_conversation_id, "conv-parent-sess");
        assert_eq!(results[0].match_confidence, MatchConfidence::High);
    }

    #[test]
    fn phase2_description_medium_confidence() {
        let parent_files = vec![DiscoveredFile {
            file_path: "/parent/session.jsonl".to_string(),
            project_dir: "/project".to_string(),
            is_subagent: false,
            session_id: "parent-sess".to_string(),
            parent_session_id: None,
        }];
        let subagent_files = vec![DiscoveredFile {
            file_path: "/sub/sub-sess.jsonl".to_string(),
            project_dir: "/project".to_string(),
            is_subagent: true,
            session_id: "sub-sess".to_string(),
            parent_session_id: Some("parent-sess".to_string()),
        }];

        let get_tool_calls = |_conv_id: &str| -> Vec<ToolCallInfo> {
            vec![ToolCallInfo {
                id: "tc-002".to_string(),
                name: "Agent".to_string(),
                input: serde_json::json!({"description": "Fix the login bug\nMore details here"}),
                output: None,
                created_at: "2024-01-01T10:00:00Z".to_string(),
            }]
        };
        let get_conv_id = |session_id: &str| -> Option<String> {
            Some(format!("conv-{}", session_id))
        };
        let get_first_msg = |_conv_id: &str| -> Option<String> {
            Some("Fix the login bug\nAdditional context".to_string())
        };

        let results = link_subagents(
            &parent_files,
            &subagent_files,
            &get_tool_calls,
            &get_conv_id,
            Some(&get_first_msg),
        );

        assert_eq!(results.len(), 1);
        assert_eq!(results[0].match_confidence, MatchConfidence::Medium);
    }

    #[test]
    fn phase3_positional_low_confidence() {
        let parent_files = vec![DiscoveredFile {
            file_path: "/parent/session.jsonl".to_string(),
            project_dir: "/project".to_string(),
            is_subagent: false,
            session_id: "parent-sess".to_string(),
            parent_session_id: None,
        }];
        let subagent_files = vec![DiscoveredFile {
            file_path: "/sub/sub-sess.jsonl".to_string(),
            project_dir: "/project".to_string(),
            is_subagent: true,
            session_id: "sub-sess".to_string(),
            parent_session_id: Some("parent-sess".to_string()),
        }];

        let get_tool_calls = |_conv_id: &str| -> Vec<ToolCallInfo> {
            vec![ToolCallInfo {
                id: "tc-003".to_string(),
                name: "Task".to_string(),
                input: serde_json::json!({}),
                output: None, // No agentId in output
                created_at: "2024-01-01T10:00:00Z".to_string(),
            }]
        };
        let get_conv_id = |session_id: &str| -> Option<String> {
            Some(format!("conv-{}", session_id))
        };
        // No first message function -> skips phase 2
        let no_first_msg: Option<&fn(&str) -> Option<String>> = None;

        let results = link_subagents(
            &parent_files,
            &subagent_files,
            &get_tool_calls,
            &get_conv_id,
            no_first_msg,
        );

        assert_eq!(results.len(), 1);
        assert_eq!(results[0].match_confidence, MatchConfidence::Low);
    }

    #[test]
    fn filters_acompact_prefixed_subagent_files() {
        let parent_files = vec![DiscoveredFile {
            file_path: "/parent/session.jsonl".to_string(),
            project_dir: "/project".to_string(),
            is_subagent: false,
            session_id: "parent-sess".to_string(),
            parent_session_id: None,
        }];
        let subagent_files = vec![
            DiscoveredFile {
                file_path: "/sub/acompact-123.jsonl".to_string(),
                project_dir: "/project".to_string(),
                is_subagent: true,
                session_id: "acompact-123".to_string(),
                parent_session_id: Some("parent-sess".to_string()),
            },
        ];

        let get_tool_calls = |_conv_id: &str| -> Vec<ToolCallInfo> {
            vec![ToolCallInfo {
                id: "tc-004".to_string(),
                name: "Task".to_string(),
                input: serde_json::json!({}),
                output: None,
                created_at: "2024-01-01T10:00:00Z".to_string(),
            }]
        };
        let get_conv_id = |session_id: &str| -> Option<String> {
            Some(format!("conv-{}", session_id))
        };
        let no_first_msg: Option<&fn(&str) -> Option<String>> = None;

        let results = link_subagents(
            &parent_files,
            &subagent_files,
            &get_tool_calls,
            &get_conv_id,
            no_first_msg,
        );

        // acompact- prefixed files should be filtered out, so no matches
        assert_eq!(results.len(), 0);
    }
}
