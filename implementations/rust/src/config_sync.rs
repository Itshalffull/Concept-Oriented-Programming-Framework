// ConfigSync Concept Implementation (Rust)
//
// Infrastructure kit — exports all configuration, imports configs,
// applies per-key overrides on named layers, and diffs current state.

use crate::storage::{ConceptStorage, StorageResult};
use serde::{Deserialize, Serialize};
use serde_json::json;

// ── ExportConfig ──────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConfigSyncExportConfigInput {}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum ConfigSyncExportConfigOutput {
    #[serde(rename = "ok")]
    Ok { data: String },
}

// ── ImportConfig ──────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConfigSyncImportConfigInput {
    pub data: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum ConfigSyncImportConfigOutput {
    #[serde(rename = "ok")]
    Ok { count: u64 },
}

// ── OverrideConfig ────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConfigSyncOverrideConfigInput {
    pub key: String,
    pub value: String,
    pub layer: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum ConfigSyncOverrideConfigOutput {
    #[serde(rename = "ok")]
    Ok { key: String },
}

// ── Diff ──────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConfigSyncDiffInput {}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum ConfigSyncDiffOutput {
    #[serde(rename = "ok")]
    Ok { changes: String },
}

// ── Handler ───────────────────────────────────────────────

pub struct ConfigSyncHandler;

impl ConfigSyncHandler {
    pub async fn export_config(
        &self,
        _input: ConfigSyncExportConfigInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<ConfigSyncExportConfigOutput> {
        let all_configs = storage.find("config", None).await?;
        let data = serde_json::to_string(&all_configs)?;
        Ok(ConfigSyncExportConfigOutput::Ok { data })
    }

    pub async fn import_config(
        &self,
        input: ConfigSyncImportConfigInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<ConfigSyncImportConfigOutput> {
        let configs: Vec<serde_json::Value> = serde_json::from_str(&input.data)?;
        let mut count: u64 = 0;

        for config in configs {
            let key = config["key"]
                .as_str()
                .unwrap_or("")
                .to_string();
            if !key.is_empty() {
                storage.put("config", &key, config).await?;
                count += 1;
            }
        }

        Ok(ConfigSyncImportConfigOutput::Ok { count })
    }

    pub async fn override_config(
        &self,
        input: ConfigSyncOverrideConfigInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<ConfigSyncOverrideConfigOutput> {
        let existing = storage.get("config", &input.key).await?;
        let now = chrono::Utc::now().to_rfc3339();

        let record = match existing {
            Some(mut r) => {
                r["value"] = json!(input.value);
                r["layer"] = json!(input.layer);
                r["updated_at"] = json!(now);
                r
            }
            None => {
                json!({
                    "key": input.key,
                    "value": input.value,
                    "layer": input.layer,
                    "created_at": now,
                    "updated_at": now,
                })
            }
        };

        storage.put("config", &input.key, record).await?;
        Ok(ConfigSyncOverrideConfigOutput::Ok { key: input.key })
    }

    pub async fn diff(
        &self,
        _input: ConfigSyncDiffInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<ConfigSyncDiffOutput> {
        let all_configs = storage.find("config", None).await?;
        // Collect configs that have overrides (layer is not "default")
        let overridden: Vec<&serde_json::Value> = all_configs
            .iter()
            .filter(|c| {
                let layer = c["layer"].as_str().unwrap_or("default");
                layer != "default"
            })
            .collect();
        let changes = serde_json::to_string(&overridden)?;
        Ok(ConfigSyncDiffOutput::Ok { changes })
    }
}
