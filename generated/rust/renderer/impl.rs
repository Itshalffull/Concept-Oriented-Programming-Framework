use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::RendererHandler;
use serde_json::json;

pub struct RendererHandlerImpl;

#[async_trait]
impl RendererHandler for RendererHandlerImpl {
    async fn render(
        &self,
        input: RendererRenderInput,
        storage: &dyn ConceptStorage,
    ) -> Result<RendererRenderOutput, Box<dyn std::error::Error>> {
        // Look up the renderer configuration
        let renderer_record = storage.get("renderer", &input.renderer).await?;
        if renderer_record.is_none() {
            return Ok(RendererRenderOutput::Error {
                message: format!("Renderer '{}' not found", input.renderer),
            });
        }

        // Parse the tree (JSON-encoded render tree) and produce output.
        // Walk the tree nodes, replacing placeholders and rendering content.
        let tree: serde_json::Value = match serde_json::from_str(&input.tree) {
            Ok(v) => v,
            Err(e) => {
                return Ok(RendererRenderOutput::Error {
                    message: format!("Invalid render tree: {}", e),
                });
            }
        };

        let mut output = String::new();
        render_node(&tree, &mut output);

        Ok(RendererRenderOutput::Ok { output })
    }

    async fn auto_placeholder(
        &self,
        input: RendererAutoPlaceholderInput,
        _storage: &dyn ConceptStorage,
    ) -> Result<RendererAutoPlaceholderOutput, Box<dyn std::error::Error>> {
        // Generate a placeholder string from the renderer and name.
        // Convention: {{renderer:name}}
        let placeholder = format!("{{{{{}}}}}", format!("{}:{}", input.renderer, input.name));
        Ok(RendererAutoPlaceholderOutput::Ok { placeholder })
    }

    async fn stream(
        &self,
        input: RendererStreamInput,
        storage: &dyn ConceptStorage,
    ) -> Result<RendererStreamOutput, Box<dyn std::error::Error>> {
        // Validate the tree before creating a stream
        let _tree: serde_json::Value = match serde_json::from_str(&input.tree) {
            Ok(v) => v,
            Err(e) => {
                return Ok(RendererStreamOutput::Error {
                    message: format!("Invalid render tree: {}", e),
                });
            }
        };

        // Create a stream ID and store the stream state
        let stream_id = format!("stream-{}", uuid_v4());
        storage.put("renderer-stream", &stream_id, json!({
            "id": stream_id,
            "renderer": input.renderer,
            "tree": input.tree,
            "status": "active"
        })).await?;

        Ok(RendererStreamOutput::Ok { stream_id })
    }

    async fn merge_cacheability(
        &self,
        input: RendererMergeCacheabilityInput,
        _storage: &dyn ConceptStorage,
    ) -> Result<RendererMergeCacheabilityOutput, Box<dyn std::error::Error>> {
        // Parse the tags (comma-separated cache directives) and merge them.
        // Most restrictive directive wins for each property.
        let tags: Vec<&str> = input.tags.split(',').map(|s| s.trim()).collect();

        let mut max_age: Option<u64> = None;
        let mut no_cache = false;
        let mut no_store = false;

        for tag in &tags {
            let tag_lower = tag.to_lowercase();
            if tag_lower.contains("no-store") {
                no_store = true;
            } else if tag_lower.contains("no-cache") {
                no_cache = true;
            } else if tag_lower.starts_with("max-age=") {
                if let Ok(age) = tag_lower.trim_start_matches("max-age=").parse::<u64>() {
                    max_age = Some(match max_age {
                        Some(existing) => existing.min(age),
                        None => age,
                    });
                }
            }
        }

        let merged = if no_store {
            "no-store".to_string()
        } else if no_cache {
            "no-cache".to_string()
        } else if let Some(age) = max_age {
            format!("max-age={}", age)
        } else {
            "public".to_string()
        };

        Ok(RendererMergeCacheabilityOutput::Ok { merged })
    }
}

/// Recursively render a JSON tree node into a string.
fn render_node(node: &serde_json::Value, output: &mut String) {
    match node {
        serde_json::Value::String(s) => output.push_str(s),
        serde_json::Value::Object(map) => {
            if let Some(tag) = map.get("tag").and_then(|v| v.as_str()) {
                output.push_str(&format!("<{}>", tag));
                if let Some(children) = map.get("children") {
                    render_node(children, output);
                }
                if let Some(text) = map.get("text").and_then(|v| v.as_str()) {
                    output.push_str(text);
                }
                output.push_str(&format!("</{}>", tag));
            } else if let Some(text) = map.get("text").and_then(|v| v.as_str()) {
                output.push_str(text);
            }
        }
        serde_json::Value::Array(arr) => {
            for item in arr {
                render_node(item, output);
            }
        }
        _ => {}
    }
}

fn uuid_v4() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let t = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default();
    format!("{:x}-{:x}", t.as_secs(), t.subsec_nanos())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;
    use serde_json::json;

    #[tokio::test]
    async fn test_render_success() {
        let storage = InMemoryStorage::new();
        storage.put("renderer", "html", json!({"name": "html"})).await.unwrap();
        let handler = RendererHandlerImpl;
        let result = handler.render(
            RendererRenderInput {
                renderer: "html".to_string(),
                tree: r#"{"tag":"div","text":"hello"}"#.to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            RendererRenderOutput::Ok { output } => {
                assert!(output.contains("div"));
                assert!(output.contains("hello"));
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_render_not_found() {
        let storage = InMemoryStorage::new();
        let handler = RendererHandlerImpl;
        let result = handler.render(
            RendererRenderInput {
                renderer: "missing".to_string(),
                tree: "{}".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            RendererRenderOutput::Error { message } => {
                assert!(message.contains("not found"));
            },
            _ => panic!("Expected Error variant"),
        }
    }

    #[tokio::test]
    async fn test_render_invalid_tree() {
        let storage = InMemoryStorage::new();
        storage.put("renderer", "html", json!({"name": "html"})).await.unwrap();
        let handler = RendererHandlerImpl;
        let result = handler.render(
            RendererRenderInput {
                renderer: "html".to_string(),
                tree: "not-json{{{".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            RendererRenderOutput::Error { message } => {
                assert!(message.contains("Invalid render tree"));
            },
            _ => panic!("Expected Error variant"),
        }
    }

    #[tokio::test]
    async fn test_auto_placeholder() {
        let storage = InMemoryStorage::new();
        let handler = RendererHandlerImpl;
        let result = handler.auto_placeholder(
            RendererAutoPlaceholderInput {
                renderer: "html".to_string(),
                name: "title".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            RendererAutoPlaceholderOutput::Ok { placeholder } => {
                assert!(placeholder.contains("html:title"));
            },
        }
    }

    #[tokio::test]
    async fn test_stream_success() {
        let storage = InMemoryStorage::new();
        let handler = RendererHandlerImpl;
        let result = handler.stream(
            RendererStreamInput {
                renderer: "html".to_string(),
                tree: r#"{"tag":"p"}"#.to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            RendererStreamOutput::Ok { stream_id } => {
                assert!(stream_id.starts_with("stream-"));
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_stream_invalid_tree() {
        let storage = InMemoryStorage::new();
        let handler = RendererHandlerImpl;
        let result = handler.stream(
            RendererStreamInput {
                renderer: "html".to_string(),
                tree: "bad json".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            RendererStreamOutput::Error { .. } => {},
            _ => panic!("Expected Error variant"),
        }
    }

    #[tokio::test]
    async fn test_merge_cacheability_no_store() {
        let storage = InMemoryStorage::new();
        let handler = RendererHandlerImpl;
        let result = handler.merge_cacheability(
            RendererMergeCacheabilityInput {
                renderer: "html".to_string(),
                tags: "max-age=300, no-store".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            RendererMergeCacheabilityOutput::Ok { merged } => {
                assert_eq!(merged, "no-store");
            },
        }
    }

    #[tokio::test]
    async fn test_merge_cacheability_max_age() {
        let storage = InMemoryStorage::new();
        let handler = RendererHandlerImpl;
        let result = handler.merge_cacheability(
            RendererMergeCacheabilityInput {
                renderer: "html".to_string(),
                tags: "max-age=300, max-age=100".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            RendererMergeCacheabilityOutput::Ok { merged } => {
                assert_eq!(merged, "max-age=100");
            },
        }
    }
}
