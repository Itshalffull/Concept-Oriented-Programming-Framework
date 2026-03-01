// ActionGuide concept implementation
// Organize concept actions into ordered, annotated workflow sequences for interface targets.
// Owns step ordering (structural) and opaque content passthrough for decorations.
// See Architecture doc Section 1.8.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::ActionGuideHandler;
use serde_json::json;
use std::sync::atomic::{AtomicU64, Ordering};

static ID_COUNTER: AtomicU64 = AtomicU64::new(0);

fn next_id() -> String {
    let id = ID_COUNTER.fetch_add(1, Ordering::SeqCst) + 1;
    format!("action-guide-{}", id)
}

const SUPPORTED_FORMATS: &[&str] = &["skill-md", "cli-help", "rest-guide", "generic"];

pub struct ActionGuideHandlerImpl;

#[async_trait]
impl ActionGuideHandler for ActionGuideHandlerImpl {
    async fn define(
        &self,
        input: ActionGuideDefineInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ActionGuideDefineOutput, Box<dyn std::error::Error>> {
        if input.steps.is_empty() {
            return Ok(ActionGuideDefineOutput::EmptySteps);
        }

        // Parse steps into structured objects
        let parsed_steps: Vec<serde_json::Value> = input.steps.iter().enumerate().map(|(i, action)| {
            json!({
                "action": action,
                "title": action,
                "prose": "",
                "order": i,
            })
        }).collect();

        let id = next_id();
        let now = chrono::Utc::now().to_rfc3339();
        let step_count = parsed_steps.len() as i64;

        storage.put("action-guide", &id, json!({
            "id": id,
            "concept": input.concept,
            "steps": serde_json::to_string(&parsed_steps)?,
            "content": input.content,
            "createdAt": now,
        })).await?;

        Ok(ActionGuideDefineOutput::Ok {
            workflow: id,
            step_count,
        })
    }

    async fn render(
        &self,
        input: ActionGuideRenderInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ActionGuideRenderOutput, Box<dyn std::error::Error>> {
        if !SUPPORTED_FORMATS.contains(&input.format.as_str()) {
            return Ok(ActionGuideRenderOutput::UnknownFormat { format: input.format });
        }

        let record = storage.get("action-guide", &input.workflow).await?;
        let record = match record {
            Some(r) => r,
            None => {
                return Ok(ActionGuideRenderOutput::UnknownFormat {
                    format: format!("Workflow '{}' not found", input.workflow),
                });
            }
        };

        let steps: Vec<serde_json::Value> = serde_json::from_str(
            record["steps"].as_str().unwrap_or("[]")
        )?;

        let content_data: serde_json::Map<String, serde_json::Value> =
            serde_json::from_str(record["content"].as_str().unwrap_or("{}")).unwrap_or_default();

        let concept = record["concept"].as_str().unwrap_or("");
        let mut sections: Vec<String> = Vec::new();

        // Render steps section based on format
        match input.format.as_str() {
            "skill-md" => {
                sections.push(format!("# Action Guide: {}", concept));
                sections.push(String::new());
                sections.push("## Steps".to_string());
                for step in &steps {
                    let order = step["order"].as_i64().unwrap_or(0);
                    let title = step["title"].as_str().unwrap_or("");
                    let action = step["action"].as_str().unwrap_or("");
                    let prose = step["prose"].as_str().unwrap_or("");
                    sections.push(format!("{}. **{}** — `{}`", order + 1, title, action));
                    if !prose.is_empty() {
                        sections.push(format!("   {}", prose));
                    }
                }
            }
            "cli-help" => {
                sections.push(format!("Action Guide: {}", concept));
                sections.push(String::new());
                sections.push("Steps:".to_string());
                for step in &steps {
                    let order = step["order"].as_i64().unwrap_or(0);
                    let title = step["title"].as_str().unwrap_or("");
                    let action = step["action"].as_str().unwrap_or("");
                    sections.push(format!("  {}. {} ({})", order + 1, title, action));
                }
            }
            "rest-guide" => {
                sections.push(format!("# {} REST Guide", concept));
                sections.push(String::new());
                for step in &steps {
                    let order = step["order"].as_i64().unwrap_or(0);
                    let title = step["title"].as_str().unwrap_or("");
                    let action = step["action"].as_str().unwrap_or("");
                    sections.push(format!("## {}. {}", order + 1, title));
                    sections.push(format!("Endpoint action: `{}`", action));
                }
            }
            _ => {
                // generic
                sections.push(format!("Action Guide: {}", concept));
                sections.push(String::new());
                for step in &steps {
                    let order = step["order"].as_i64().unwrap_or(0);
                    let title = step["title"].as_str().unwrap_or("");
                    let action = step["action"].as_str().unwrap_or("");
                    sections.push(format!("Step {}: {} [{}]", order + 1, title, action));
                }
            }
        }

        // Render decoration content keys
        for (key, value) in &content_data {
            sections.push(String::new());
            if input.format == "skill-md" {
                // Title-case the key, replacing hyphens with spaces
                let title_key: String = key.replace('-', " ")
                    .split_whitespace()
                    .map(|w| {
                        let mut c = w.chars();
                        match c.next() {
                            None => String::new(),
                            Some(f) => f.to_uppercase().to_string() + &c.as_str().to_lowercase(),
                        }
                    })
                    .collect::<Vec<_>>()
                    .join(" ");
                sections.push(format!("## {}", title_key));
                if let Some(arr) = value.as_array() {
                    for item in arr {
                        if let Some(obj) = item.as_object() {
                            if let (Some(title), Some(rule)) = (obj.get("title"), obj.get("rule")) {
                                sections.push(format!("- **{}**: {}", title.as_str().unwrap_or(""), rule.as_str().unwrap_or("")));
                            } else if let Some(title) = obj.get("title") {
                                sections.push(format!("- **{}**", title.as_str().unwrap_or("")));
                            } else {
                                sections.push(format!("- {}", serde_json::to_string(item).unwrap_or_default()));
                            }
                        } else {
                            sections.push(format!("- {}", item));
                        }
                    }
                } else if let Some(s) = value.as_str() {
                    sections.push(s.to_string());
                } else {
                    sections.push(serde_json::to_string_pretty(value).unwrap_or_default());
                }
            } else {
                sections.push(format!("[{}]", key));
                if let Some(s) = value.as_str() {
                    sections.push(s.to_string());
                } else {
                    sections.push(serde_json::to_string(value).unwrap_or_default());
                }
            }
        }

        let rendered = sections.join("\n");
        Ok(ActionGuideRenderOutput::Ok { content: rendered })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_define_creates_workflow() {
        let storage = InMemoryStorage::new();
        let handler = ActionGuideHandlerImpl;
        let result = handler.define(
            ActionGuideDefineInput {
                concept: "article".to_string(),
                steps: vec!["create".to_string(), "publish".to_string()],
                content: "{}".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ActionGuideDefineOutput::Ok { workflow, step_count } => {
                assert!(!workflow.is_empty());
                assert_eq!(step_count, 2);
            }
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_define_empty_steps_returns_error() {
        let storage = InMemoryStorage::new();
        let handler = ActionGuideHandlerImpl;
        let result = handler.define(
            ActionGuideDefineInput {
                concept: "article".to_string(),
                steps: vec![],
                content: "{}".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ActionGuideDefineOutput::EmptySteps => {}
            _ => panic!("Expected EmptySteps variant"),
        }
    }

    #[tokio::test]
    async fn test_render_unknown_format() {
        let storage = InMemoryStorage::new();
        let handler = ActionGuideHandlerImpl;
        let result = handler.render(
            ActionGuideRenderInput {
                workflow: "any".to_string(),
                format: "invalid-format".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ActionGuideRenderOutput::UnknownFormat { format } => {
                assert_eq!(format, "invalid-format");
            }
            _ => panic!("Expected UnknownFormat variant"),
        }
    }

    #[tokio::test]
    async fn test_render_skill_md_format() {
        let storage = InMemoryStorage::new();
        let handler = ActionGuideHandlerImpl;
        let define_result = handler.define(
            ActionGuideDefineInput {
                concept: "user".to_string(),
                steps: vec!["register".to_string(), "verify".to_string()],
                content: "{}".to_string(),
            },
            &storage,
        ).await.unwrap();
        let workflow_id = match define_result {
            ActionGuideDefineOutput::Ok { workflow, .. } => workflow,
            _ => panic!("Expected Ok"),
        };
        let result = handler.render(
            ActionGuideRenderInput {
                workflow: workflow_id,
                format: "skill-md".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ActionGuideRenderOutput::Ok { content } => {
                assert!(content.contains("# Action Guide: user"));
                assert!(content.contains("## Steps"));
            }
            _ => panic!("Expected Ok variant"),
        }
    }
}
