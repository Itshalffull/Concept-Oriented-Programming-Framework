// FlowTrace concept implementation
// Walks ActionLog provenance edges from a flow root to build a FlowTrace tree.
// See Architecture doc Section 16.1 / 17.1

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::FlowTraceHandler;
use serde_json::json;

pub struct FlowTraceHandlerImpl;

#[async_trait]
impl FlowTraceHandler for FlowTraceHandlerImpl {
    async fn build(
        &self,
        input: FlowTraceBuildInput,
        _storage: &dyn ConceptStorage,
    ) -> Result<FlowTraceBuildOutput, Box<dyn std::error::Error>> {
        if input.flow_id.is_empty() {
            return Ok(FlowTraceBuildOutput::Error {
                message: "flowId is required".to_string(),
            });
        }

        // Building a trace requires ActionLog and SyncIndex which are
        // only available via the engine runtime. Return error for
        // standalone invocations.
        Ok(FlowTraceBuildOutput::Error {
            message: format!("No action log available for flow: {}", input.flow_id),
        })
    }

    async fn render(
        &self,
        input: FlowTraceRenderInput,
        _storage: &dyn ConceptStorage,
    ) -> Result<FlowTraceRenderOutput, Box<dyn std::error::Error>> {
        let trace_str = &input.trace;
        if trace_str.is_empty() {
            return Ok(FlowTraceRenderOutput::Ok {
                output: String::new(),
            });
        }

        // Parse the trace JSON
        let trace: serde_json::Value = match serde_json::from_str(trace_str) {
            Ok(v) => v,
            Err(_) => {
                return Ok(FlowTraceRenderOutput::Ok {
                    output: String::new(),
                });
            }
        };

        let options = &input.options;
        let use_json = options.get("json").and_then(|v| v.as_bool()).unwrap_or(false);

        if use_json {
            return Ok(FlowTraceRenderOutput::Ok {
                output: serde_json::to_string_pretty(&trace)?,
            });
        }

        // Render the flow trace as a tree-formatted string
        let flow_id = trace.get("flowId").and_then(|v| v.as_str()).unwrap_or("unknown");
        let status = trace.get("status").and_then(|v| v.as_str()).unwrap_or("unknown");
        let duration_ms = trace.get("durationMs").and_then(|v| v.as_i64()).unwrap_or(0);

        let status_label = status.to_uppercase();
        let mut lines = Vec::new();
        lines.push(format!("{}  ({}ms total, {})", flow_id, duration_ms, status_label));
        lines.push(String::from("\u{2502}"));

        // Render root node
        if let Some(root) = trace.get("root") {
            render_node(root, &mut lines, "", true);
        }

        Ok(FlowTraceRenderOutput::Ok {
            output: lines.join("\n"),
        })
    }
}

fn render_node(node: &serde_json::Value, lines: &mut Vec<String>, prefix: &str, is_last: bool) {
    let connector = if is_last { "\u{2514}\u{2500}" } else { "\u{251C}\u{2500}" };
    let action = node.get("action").and_then(|v| v.as_str()).unwrap_or("unknown");
    let variant = node.get("variant").and_then(|v| v.as_str()).unwrap_or("ok");
    let duration_ms = node.get("durationMs").and_then(|v| v.as_i64()).unwrap_or(0);

    let icon = if variant == "ok" { "\u{2705}" } else { "\u{274C}" };
    let padding = " ".repeat(40_usize.saturating_sub(action.len() + variant.len() + 4));
    lines.push(format!("{}{} {} {} \u{2192} {}{}{}ms",
        prefix, connector, icon, action, variant, padding, duration_ms));

    let child_prefix = format!("{}{}", prefix, if is_last { "   " } else { "\u{2502}  " });

    if let Some(children) = node.get("children").and_then(|v| v.as_array()) {
        for (i, sync_node) in children.iter().enumerate() {
            let is_last_child = i == children.len() - 1;
            let sync_connector = if is_last_child { "\u{2514}\u{2500}" } else { "\u{251C}\u{2500}" };
            let sync_name = sync_node.get("syncName").and_then(|v| v.as_str()).unwrap_or("unknown");
            let fired = sync_node.get("fired").and_then(|v| v.as_bool()).unwrap_or(false);

            if fired {
                lines.push(format!("{}{} [{}] \u{2192}", child_prefix, sync_connector, sync_name));
                if let Some(child) = sync_node.get("child") {
                    let sync_child_prefix = format!("{}{}", child_prefix,
                        if is_last_child { "   " } else { "\u{2502}  " });
                    render_node(child, lines, &sync_child_prefix, true);
                }
            } else {
                lines.push(format!("{}{} \u{26A0} [{}] did not fire", child_prefix, sync_connector, sync_name));
                if let Some(missing) = sync_node.get("missingPattern").and_then(|v| v.as_str()) {
                    let unfired_prefix = format!("{}{}", child_prefix,
                        if is_last_child { "   " } else { "\u{2502}  " });
                    lines.push(format!("{}   ({})", unfired_prefix, missing));
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_build_empty_flow_id() {
        let storage = InMemoryStorage::new();
        let handler = FlowTraceHandlerImpl;
        let result = handler.build(
            FlowTraceBuildInput { flow_id: "".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            FlowTraceBuildOutput::Error { message } => {
                assert!(message.contains("required"));
            },
            _ => panic!("Expected Error variant"),
        }
    }

    #[tokio::test]
    async fn test_build_returns_error_for_standalone() {
        let storage = InMemoryStorage::new();
        let handler = FlowTraceHandlerImpl;
        let result = handler.build(
            FlowTraceBuildInput { flow_id: "flow-123".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            FlowTraceBuildOutput::Error { message } => {
                assert!(message.contains("flow-123"));
            },
            _ => panic!("Expected Error variant"),
        }
    }

    #[tokio::test]
    async fn test_render_empty_trace() {
        let storage = InMemoryStorage::new();
        let handler = FlowTraceHandlerImpl;
        let result = handler.render(
            FlowTraceRenderInput {
                trace: "".to_string(),
                options: json!({}),
            },
            &storage,
        ).await.unwrap();
        match result {
            FlowTraceRenderOutput::Ok { output } => {
                assert!(output.is_empty());
            },
        }
    }

    #[tokio::test]
    async fn test_render_json_mode() {
        let storage = InMemoryStorage::new();
        let handler = FlowTraceHandlerImpl;
        let trace = json!({
            "flowId": "flow-1",
            "status": "ok",
            "durationMs": 100,
        });
        let result = handler.render(
            FlowTraceRenderInput {
                trace: serde_json::to_string(&trace).unwrap(),
                options: json!({"json": true}),
            },
            &storage,
        ).await.unwrap();
        match result {
            FlowTraceRenderOutput::Ok { output } => {
                assert!(output.contains("flow-1"));
            },
        }
    }

    #[tokio::test]
    async fn test_render_tree_mode() {
        let storage = InMemoryStorage::new();
        let handler = FlowTraceHandlerImpl;
        let trace = json!({
            "flowId": "flow-2",
            "status": "ok",
            "durationMs": 250,
            "root": {
                "action": "create",
                "variant": "ok",
                "durationMs": 50,
            }
        });
        let result = handler.render(
            FlowTraceRenderInput {
                trace: serde_json::to_string(&trace).unwrap(),
                options: json!({}),
            },
            &storage,
        ).await.unwrap();
        match result {
            FlowTraceRenderOutput::Ok { output } => {
                assert!(output.contains("flow-2"));
                assert!(output.contains("250ms"));
            },
        }
    }
}
