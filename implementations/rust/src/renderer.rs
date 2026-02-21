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
