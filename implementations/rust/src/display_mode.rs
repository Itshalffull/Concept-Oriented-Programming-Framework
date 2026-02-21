// DisplayMode Concept Implementation (Rust)
//
// Manages display modes for view/form rendering with field-level formatting.
// See Architecture doc Sections on display and rendering.

use crate::storage::{ConceptStorage, StorageResult};
use serde::{Deserialize, Serialize};
use serde_json::json;

// ── DefineMode ────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DefineModeInput {
    pub name: String,
    pub mode_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum DefineModeOutput {
    #[serde(rename = "ok")]
    Ok { mode_id: String },
}

// ── ConfigureFieldDisplay ─────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConfigureFieldDisplayInput {
    pub schema_id: String,
    pub mode_id: String,
    pub field_id: String,
    pub formatter: String,
    pub settings: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum ConfigureFieldDisplayOutput {
    #[serde(rename = "ok")]
    Ok { mode_id: String },
}

// ── RenderInMode ──────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RenderInModeInput {
    pub node_id: String,
    pub mode_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum RenderInModeOutput {
    #[serde(rename = "ok")]
    Ok { node_id: String, rendered: String },
    #[serde(rename = "notfound")]
    NotFound { message: String },
}

// ── Handler ───────────────────────────────────────────────

pub struct DisplayModeHandler;

impl DisplayModeHandler {
    pub async fn define_mode(
        &self,
        input: DefineModeInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<DefineModeOutput> {
        let mode_id = format!(
            "mode_{}_{}",
            input.mode_type,
            input.name.to_lowercase().replace(' ', "_")
        );

        storage
            .put(
                "display_mode",
                &mode_id,
                json!({
                    "mode_id": mode_id,
                    "name": input.name,
                    "mode_type": input.mode_type,
                }),
            )
            .await?;

        Ok(DefineModeOutput::Ok { mode_id })
    }

    pub async fn configure_field_display(
        &self,
        input: ConfigureFieldDisplayInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<ConfigureFieldDisplayOutput> {
        let config_key = format!("{}:{}:{}", input.schema_id, input.mode_id, input.field_id);
        let settings: serde_json::Value =
            serde_json::from_str(&input.settings).unwrap_or(json!({}));

        storage
            .put(
                "field_display_config",
                &config_key,
                json!({
                    "schema_id": input.schema_id,
                    "mode_id": input.mode_id,
                    "field_id": input.field_id,
                    "formatter": input.formatter,
                    "settings": settings,
                }),
            )
            .await?;

        Ok(ConfigureFieldDisplayOutput::Ok {
            mode_id: input.mode_id,
        })
    }

    pub async fn render_in_mode(
        &self,
        input: RenderInModeInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<RenderInModeOutput> {
        let mode = storage.get("display_mode", &input.mode_id).await?;

        if mode.is_none() {
            return Ok(RenderInModeOutput::NotFound {
                message: format!("Display mode '{}' not found", input.mode_id),
            });
        }

        // Collect all field display configs for this mode
        let all_configs = storage.find("field_display_config", None).await?;
        let mode_configs: Vec<&serde_json::Value> = all_configs
            .iter()
            .filter(|c| c["mode_id"].as_str() == Some(&input.mode_id))
            .collect();

        let rendered = json!({
            "node_id": input.node_id,
            "mode_id": input.mode_id,
            "field_configs": mode_configs,
        });

        Ok(RenderInModeOutput::Ok {
            node_id: input.node_id,
            rendered: serde_json::to_string(&rendered)?,
        })
    }
}
