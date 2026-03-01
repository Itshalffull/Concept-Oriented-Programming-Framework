// EnrichmentRenderer Handler Implementation
//
// Renders opaque enrichment JSON into formatted output strings
// using data-driven templates. Handlers map enrichment keys to
// built-in render patterns (list, checklist, code-list, callout,
// heading-body, bad-good, etc.) with {{field}} interpolation.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::EnrichmentRendererHandler;
use serde_json::json;
use std::sync::atomic::{AtomicU64, Ordering};

static ID_COUNTER: AtomicU64 = AtomicU64::new(0);

fn next_id() -> String {
    let id = ID_COUNTER.fetch_add(1, Ordering::SeqCst) + 1;
    format!("enrichment-renderer-{}", id)
}

const BUILT_IN_PATTERNS: &[&str] = &[
    "list", "checklist", "code-list", "link-list", "callout",
    "heading-body", "bad-good", "scaffold-list", "slash-list",
    "keyed-checklist", "inline-list",
];

/// Interpolate {{field}} placeholders in a template string.
fn interpolate(template: &str, data: &serde_json::Map<String, serde_json::Value>) -> String {
    let mut result = template.to_string();
    for (key, value) in data {
        let placeholder = format!("{{{{{}}}}}", key);
        let replacement = match value {
            serde_json::Value::String(s) => s.clone(),
            serde_json::Value::Null => String::new(),
            other => other.to_string(),
        };
        result = result.replace(&placeholder, &replacement);
    }
    result
}

/// Render a section using a pattern and template config.
fn render_pattern(pattern: &str, template_str: &str, data: &serde_json::Value) -> String {
    let template_config: serde_json::Map<String, serde_json::Value> =
        serde_json::from_str(template_str).unwrap_or_default();

    let record = data.as_object().cloned().unwrap_or_default();
    let items = data.as_array().cloned().unwrap_or_default();

    match pattern {
        "heading-body" => {
            let heading_tmpl = template_config.get("heading")
                .and_then(|v| v.as_str()).unwrap_or("{{heading}}");
            let heading = interpolate(heading_tmpl, &record);
            let body = record.get("body").and_then(|v| v.as_str()).unwrap_or("");
            format!("### {}\n\n{}", heading, body)
        }
        "list" => {
            let title = template_config.get("title").and_then(|v| v.as_str()).unwrap_or("");
            let item_tmpl = template_config.get("itemTemplate")
                .and_then(|v| v.as_str()).unwrap_or("{{title}}");
            let lines: Vec<String> = items.iter().map(|item| {
                match item {
                    serde_json::Value::String(s) => format!("- {}", s),
                    serde_json::Value::Object(obj) => format!("- {}", interpolate(item_tmpl, obj)),
                    other => format!("- {}", other),
                }
            }).collect();
            let prefix = if title.is_empty() { String::new() } else { format!("### {}\n\n", title) };
            format!("{}{}", prefix, lines.join("\n"))
        }
        "checklist" => {
            let title = template_config.get("title").and_then(|v| v.as_str()).unwrap_or("");
            let lines: Vec<String> = items.iter().map(|item| {
                match item {
                    serde_json::Value::String(s) => format!("- [ ] {}", s),
                    serde_json::Value::Object(obj) => {
                        let label = obj.get("label").or_else(|| obj.get("title"))
                            .and_then(|v| v.as_str()).unwrap_or("");
                        format!("- [ ] {}", label)
                    }
                    other => format!("- [ ] {}", other),
                }
            }).collect();
            let prefix = if title.is_empty() { String::new() } else { format!("### {}\n\n", title) };
            format!("{}{}", prefix, lines.join("\n"))
        }
        "callout" => {
            let kind = template_config.get("kind").and_then(|v| v.as_str()).unwrap_or("info");
            let body = match data {
                serde_json::Value::String(s) => s.clone(),
                _ => record.get("body").and_then(|v| v.as_str())
                    .unwrap_or(&serde_json::to_string(data).unwrap_or_default()).to_string(),
            };
            format!("> **{}**: {}", kind.to_uppercase(), body)
        }
        "bad-good" => {
            let title = template_config.get("title").and_then(|v| v.as_str()).unwrap_or("");
            let bad = record.get("bad").and_then(|v| v.as_array()).cloned().unwrap_or_default();
            let good = record.get("good").and_then(|v| v.as_array()).cloned().unwrap_or_default();
            let mut lines = Vec::new();
            if !title.is_empty() { lines.push(format!("### {}", title)); }
            if !bad.is_empty() {
                lines.push(String::new());
                lines.push("**Avoid:**".to_string());
                for b in &bad { lines.push(format!("- {}", b.as_str().unwrap_or(""))); }
            }
            if !good.is_empty() {
                lines.push(String::new());
                lines.push("**Prefer:**".to_string());
                for g in &good { lines.push(format!("- {}", g.as_str().unwrap_or(""))); }
            }
            lines.join("\n")
        }
        _ => serde_json::to_string(data).unwrap_or_default(),
    }
}

pub struct EnrichmentRendererHandlerImpl;

#[async_trait]
impl EnrichmentRendererHandler for EnrichmentRendererHandlerImpl {
    async fn register(
        &self,
        input: EnrichmentRendererRegisterInput,
        storage: &dyn ConceptStorage,
    ) -> Result<EnrichmentRendererRegisterOutput, Box<dyn std::error::Error>> {
        if !BUILT_IN_PATTERNS.contains(&input.pattern.as_str()) {
            return Ok(EnrichmentRendererRegisterOutput::UnknownPattern {
                pattern: input.pattern,
            });
        }

        // Validate template is valid JSON
        if serde_json::from_str::<serde_json::Value>(&input.template).is_err() {
            return Ok(EnrichmentRendererRegisterOutput::InvalidTemplate {
                template: input.template,
                reason: "Template is not valid JSON".to_string(),
            });
        }

        // Check for existing handler and replace
        let existing = storage.find("enrichment-renderer", Some(&json!({"key": input.key, "format": input.format}))).await?;
        if !existing.is_empty() {
            let existing_id = existing[0].get("id").and_then(|v| v.as_str()).unwrap_or_default().to_string();
            storage.put("enrichment-renderer", &existing_id, json!({
                "id": existing_id,
                "key": input.key,
                "format": input.format,
                "order": input.order,
                "pattern": input.pattern,
                "template": input.template,
            })).await?;
            return Ok(EnrichmentRendererRegisterOutput::Ok { handler: existing_id });
        }

        let id = next_id();
        storage.put("enrichment-renderer", &id, json!({
            "id": id,
            "key": input.key,
            "format": input.format,
            "order": input.order,
            "pattern": input.pattern,
            "template": input.template,
        })).await?;

        Ok(EnrichmentRendererRegisterOutput::Ok { handler: id })
    }

    async fn render(
        &self,
        input: EnrichmentRendererRenderInput,
        storage: &dyn ConceptStorage,
    ) -> Result<EnrichmentRendererRenderOutput, Box<dyn std::error::Error>> {
        let content_data: serde_json::Map<String, serde_json::Value> = match serde_json::from_str(&input.content) {
            Ok(serde_json::Value::Object(m)) => m,
            _ => return Ok(EnrichmentRendererRenderOutput::InvalidContent {
                reason: "Content is not valid JSON".to_string(),
            }),
        };

        let handlers = storage.find("enrichment-renderer", Some(&json!({"format": input.format}))).await?;
        if handlers.is_empty() {
            return Ok(EnrichmentRendererRenderOutput::UnknownFormat {
                format: input.format,
            });
        }

        // Sort by order
        let mut sorted = handlers.clone();
        sorted.sort_by(|a, b| {
            let oa = a.get("order").and_then(|v| v.as_i64()).unwrap_or(0);
            let ob = b.get("order").and_then(|v| v.as_i64()).unwrap_or(0);
            oa.cmp(&ob)
        });

        let mut handled_keys = std::collections::HashSet::new();
        let mut sections = Vec::new();

        for handler in &sorted {
            let handler_key = handler.get("key").and_then(|v| v.as_str()).unwrap_or("");
            if let Some(data) = content_data.get(handler_key) {
                handled_keys.insert(handler_key.to_string());
                let pattern = handler.get("pattern").and_then(|v| v.as_str()).unwrap_or("");
                let template = handler.get("template").and_then(|v| v.as_str()).unwrap_or("{}");
                sections.push(render_pattern(pattern, template, data));
            }
        }

        let unhandled_keys: Vec<String> = content_data.keys()
            .filter(|k| !handled_keys.contains(*k))
            .cloned()
            .collect();

        Ok(EnrichmentRendererRenderOutput::Ok {
            output: sections.join("\n\n"),
            section_count: sections.len() as i64,
            unhandled_keys,
        })
    }

    async fn list_handlers(
        &self,
        input: EnrichmentRendererListHandlersInput,
        storage: &dyn ConceptStorage,
    ) -> Result<EnrichmentRendererListHandlersOutput, Box<dyn std::error::Error>> {
        let handlers = storage.find("enrichment-renderer", Some(&json!({"format": input.format}))).await?;
        let mut sorted = handlers.clone();
        sorted.sort_by(|a, b| {
            let oa = a.get("order").and_then(|v| v.as_i64()).unwrap_or(0);
            let ob = b.get("order").and_then(|v| v.as_i64()).unwrap_or(0);
            oa.cmp(&ob)
        });
        let keys: Vec<String> = sorted.iter()
            .filter_map(|h| h.get("key").and_then(|v| v.as_str()).map(String::from))
            .collect();
        let count = keys.len() as i64;

        Ok(EnrichmentRendererListHandlersOutput::Ok { handlers: keys, count })
    }

    async fn list_patterns(
        &self,
        _input: EnrichmentRendererListPatternsInput,
        _storage: &dyn ConceptStorage,
    ) -> Result<EnrichmentRendererListPatternsOutput, Box<dyn std::error::Error>> {
        Ok(EnrichmentRendererListPatternsOutput::Ok {
            patterns: BUILT_IN_PATTERNS.iter().map(|s| s.to_string()).collect(),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_register_valid_pattern() {
        let storage = InMemoryStorage::new();
        let handler = EnrichmentRendererHandlerImpl;
        let result = handler.register(
            EnrichmentRendererRegisterInput {
                key: "summary".to_string(),
                format: "markdown".to_string(),
                order: 1,
                pattern: "heading-body".to_string(),
                template: r#"{"heading": "{{heading}}"}"#.to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            EnrichmentRendererRegisterOutput::Ok { handler: h } => {
                assert!(!h.is_empty());
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_register_unknown_pattern() {
        let storage = InMemoryStorage::new();
        let handler = EnrichmentRendererHandlerImpl;
        let result = handler.register(
            EnrichmentRendererRegisterInput {
                key: "summary".to_string(),
                format: "markdown".to_string(),
                order: 1,
                pattern: "unknown-pattern".to_string(),
                template: "{}".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            EnrichmentRendererRegisterOutput::UnknownPattern { .. } => {},
            _ => panic!("Expected UnknownPattern variant"),
        }
    }

    #[tokio::test]
    async fn test_register_invalid_template() {
        let storage = InMemoryStorage::new();
        let handler = EnrichmentRendererHandlerImpl;
        let result = handler.register(
            EnrichmentRendererRegisterInput {
                key: "summary".to_string(),
                format: "markdown".to_string(),
                order: 1,
                pattern: "list".to_string(),
                template: "not-json{".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            EnrichmentRendererRegisterOutput::InvalidTemplate { .. } => {},
            _ => panic!("Expected InvalidTemplate variant"),
        }
    }

    #[tokio::test]
    async fn test_render_invalid_content() {
        let storage = InMemoryStorage::new();
        let handler = EnrichmentRendererHandlerImpl;
        let result = handler.render(
            EnrichmentRendererRenderInput {
                content: "not-json".to_string(),
                format: "markdown".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            EnrichmentRendererRenderOutput::InvalidContent { .. } => {},
            _ => panic!("Expected InvalidContent variant"),
        }
    }

    #[tokio::test]
    async fn test_list_patterns() {
        let storage = InMemoryStorage::new();
        let handler = EnrichmentRendererHandlerImpl;
        let result = handler.list_patterns(
            EnrichmentRendererListPatternsInput {},
            &storage,
        ).await.unwrap();
        match result {
            EnrichmentRendererListPatternsOutput::Ok { patterns } => {
                assert!(patterns.contains(&"list".to_string()));
                assert!(patterns.contains(&"checklist".to_string()));
            },
        }
    }
}
