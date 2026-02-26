// Renderer Concept Implementation (Rust)
//
// Manages element rendering with caching and placeholder support.
// See Architecture doc Sections on rendering pipeline.

use crate::storage::{ConceptStorage, StorageResult};
use serde::{Deserialize, Serialize};
use serde_json::json;

// ── Render ────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RenderInput {
    pub element_id: String,
    pub context: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum RenderOutput {
    #[serde(rename = "ok")]
    Ok { element_id: String, output: String },
}

// ── AutoPlaceholder ───────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AutoPlaceholderInput {
    pub element_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum AutoPlaceholderOutput {
    #[serde(rename = "ok")]
    Ok {
        element_id: String,
        placeholder_id: String,
    },
}

// ── MergeCacheability ─────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MergeCacheabilityInput {
    pub parent_tags: String,
    pub child_tags: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum MergeCacheabilityOutput {
    #[serde(rename = "ok")]
    Ok { merged_tags: String },
}

// ── Handler ───────────────────────────────────────────────

pub struct RendererHandler;

impl RendererHandler {
    pub async fn render(
        &self,
        input: RenderInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<RenderOutput> {
        let context: serde_json::Value =
            serde_json::from_str(&input.context).unwrap_or(json!({}));

        // Generate HTML output from context
        let html_output = format!(
            "<div data-element=\"{}\">{}</div>",
            input.element_id,
            context
                .get("content")
                .and_then(|c| c.as_str())
                .unwrap_or("")
        );

        // Cache the rendered output
        storage
            .put(
                "render_cache",
                &input.element_id,
                json!({
                    "element_id": input.element_id,
                    "output": html_output,
                    "context": context,
                    "rendered_at": chrono::Utc::now().to_rfc3339(),
                }),
            )
            .await?;

        Ok(RenderOutput::Ok {
            element_id: input.element_id,
            output: html_output,
        })
    }

    pub async fn auto_placeholder(
        &self,
        input: AutoPlaceholderInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<AutoPlaceholderOutput> {
        let placeholder_id = format!("placeholder_{}", input.element_id);

        let placeholder_html = format!(
            "<div data-placeholder=\"{}\" class=\"lazy-placeholder\"></div>",
            input.element_id
        );

        storage
            .put(
                "render_cache",
                &placeholder_id,
                json!({
                    "element_id": input.element_id,
                    "placeholder_id": placeholder_id,
                    "output": placeholder_html,
                    "is_placeholder": true,
                }),
            )
            .await?;

        Ok(AutoPlaceholderOutput::Ok {
            element_id: input.element_id,
            placeholder_id,
        })
    }

    pub async fn merge_cacheability(
        &self,
        input: MergeCacheabilityInput,
        _storage: &dyn ConceptStorage,
    ) -> StorageResult<MergeCacheabilityOutput> {
        let parent: Vec<String> =
            serde_json::from_str(&input.parent_tags).unwrap_or_default();
        let child: Vec<String> =
            serde_json::from_str(&input.child_tags).unwrap_or_default();

        // Merge tags: union of parent and child, deduplicated
        let mut merged: Vec<String> = parent;
        for tag in child {
            if !merged.contains(&tag) {
                merged.push(tag);
            }
        }

        Ok(MergeCacheabilityOutput::Ok {
            merged_tags: serde_json::to_string(&merged)?,
        })
    }
}

// ── Tests ──────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    // ── render tests ───────────────────────────────────────

    #[tokio::test]
    async fn render_returns_html_output() {
        let storage = InMemoryStorage::new();
        let handler = RendererHandler;

        let result = handler
            .render(
                RenderInput {
                    element_id: "el1".into(),
                    context: r#"{"content": "Hello World"}"#.into(),
                },
                &storage,
            )
            .await
            .unwrap();

        match result {
            RenderOutput::Ok { element_id, output } => {
                assert_eq!(element_id, "el1");
                assert!(output.contains("Hello World"));
                assert!(output.contains("data-element=\"el1\""));
            }
        }
    }

    #[tokio::test]
    async fn render_caches_output_in_storage() {
        let storage = InMemoryStorage::new();
        let handler = RendererHandler;

        handler
            .render(
                RenderInput {
                    element_id: "el2".into(),
                    context: r#"{"content": "Cached"}"#.into(),
                },
                &storage,
            )
            .await
            .unwrap();

        let record = storage.get("render_cache", "el2").await.unwrap();
        assert!(record.is_some());
        let record = record.unwrap();
        assert!(record["output"].as_str().unwrap().contains("Cached"));
    }

    #[tokio::test]
    async fn render_handles_empty_context() {
        let storage = InMemoryStorage::new();
        let handler = RendererHandler;

        let result = handler
            .render(
                RenderInput {
                    element_id: "el3".into(),
                    context: "{}".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        match result {
            RenderOutput::Ok { output, .. } => {
                assert!(output.contains("data-element=\"el3\""));
            }
        }
    }

    // ── auto_placeholder tests ─────────────────────────────

    #[tokio::test]
    async fn auto_placeholder_returns_placeholder_id() {
        let storage = InMemoryStorage::new();
        let handler = RendererHandler;

        let result = handler
            .auto_placeholder(
                AutoPlaceholderInput {
                    element_id: "widget1".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        match result {
            AutoPlaceholderOutput::Ok {
                element_id,
                placeholder_id,
            } => {
                assert_eq!(element_id, "widget1");
                assert_eq!(placeholder_id, "placeholder_widget1");
            }
        }
    }

    #[tokio::test]
    async fn auto_placeholder_stores_placeholder_in_cache() {
        let storage = InMemoryStorage::new();
        let handler = RendererHandler;

        handler
            .auto_placeholder(
                AutoPlaceholderInput {
                    element_id: "widget2".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        let record = storage
            .get("render_cache", "placeholder_widget2")
            .await
            .unwrap();
        assert!(record.is_some());
        let record = record.unwrap();
        assert_eq!(record["is_placeholder"], serde_json::json!(true));
    }

    // ── merge_cacheability tests ───────────────────────────

    #[tokio::test]
    async fn merge_cacheability_unions_tags() {
        let storage = InMemoryStorage::new();
        let handler = RendererHandler;

        let result = handler
            .merge_cacheability(
                MergeCacheabilityInput {
                    parent_tags: r#"["user","page"]"#.into(),
                    child_tags: r#"["page","block"]"#.into(),
                },
                &storage,
            )
            .await
            .unwrap();

        match result {
            MergeCacheabilityOutput::Ok { merged_tags } => {
                let parsed: Vec<String> = serde_json::from_str(&merged_tags).unwrap();
                assert_eq!(parsed.len(), 3);
                assert!(parsed.contains(&"user".to_string()));
                assert!(parsed.contains(&"page".to_string()));
                assert!(parsed.contains(&"block".to_string()));
            }
        }
    }

    #[tokio::test]
    async fn merge_cacheability_handles_empty_tags() {
        let storage = InMemoryStorage::new();
        let handler = RendererHandler;

        let result = handler
            .merge_cacheability(
                MergeCacheabilityInput {
                    parent_tags: "[]".into(),
                    child_tags: r#"["tag1"]"#.into(),
                },
                &storage,
            )
            .await
            .unwrap();

        match result {
            MergeCacheabilityOutput::Ok { merged_tags } => {
                let parsed: Vec<String> = serde_json::from_str(&merged_tags).unwrap();
                assert_eq!(parsed.len(), 1);
                assert_eq!(parsed[0], "tag1");
            }
        }
    }
}
