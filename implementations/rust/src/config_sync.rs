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

// ── Tests ──────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    // --- export_config ---

    #[tokio::test]
    async fn export_config_returns_all_configs() {
        let storage = InMemoryStorage::new();
        let handler = ConfigSyncHandler;

        // Insert a config entry directly
        storage
            .put("config", "site.name", json!({ "key": "site.name", "value": "MySite" }))
            .await
            .unwrap();

        let result = handler
            .export_config(ConfigSyncExportConfigInput {}, &storage)
            .await
            .unwrap();

        match result {
            ConfigSyncExportConfigOutput::Ok { data } => {
                assert!(data.contains("site.name"));
                assert!(data.contains("MySite"));
            }
        }
    }

    #[tokio::test]
    async fn export_config_empty_when_no_configs() {
        let storage = InMemoryStorage::new();
        let handler = ConfigSyncHandler;

        let result = handler
            .export_config(ConfigSyncExportConfigInput {}, &storage)
            .await
            .unwrap();

        match result {
            ConfigSyncExportConfigOutput::Ok { data } => {
                let parsed: Vec<serde_json::Value> = serde_json::from_str(&data).unwrap();
                assert!(parsed.is_empty());
            }
        }
    }

    // --- import_config ---

    #[tokio::test]
    async fn import_config_imports_entries() {
        let storage = InMemoryStorage::new();
        let handler = ConfigSyncHandler;

        let data = serde_json::to_string(&vec![
            json!({ "key": "k1", "value": "v1" }),
            json!({ "key": "k2", "value": "v2" }),
        ])
        .unwrap();

        let result = handler
            .import_config(ConfigSyncImportConfigInput { data }, &storage)
            .await
            .unwrap();

        match result {
            ConfigSyncImportConfigOutput::Ok { count } => assert_eq!(count, 2),
        }

        let r = storage.get("config", "k1").await.unwrap();
        assert!(r.is_some());
    }

    #[tokio::test]
    async fn import_config_skips_entries_without_key() {
        let storage = InMemoryStorage::new();
        let handler = ConfigSyncHandler;

        let data = serde_json::to_string(&vec![
            json!({ "value": "no_key" }),
            json!({ "key": "valid", "value": "v" }),
        ])
        .unwrap();

        let result = handler
            .import_config(ConfigSyncImportConfigInput { data }, &storage)
            .await
            .unwrap();

        match result {
            ConfigSyncImportConfigOutput::Ok { count } => assert_eq!(count, 1),
        }
    }

    // --- override_config ---

    #[tokio::test]
    async fn override_config_creates_new_entry() {
        let storage = InMemoryStorage::new();
        let handler = ConfigSyncHandler;

        let result = handler
            .override_config(
                ConfigSyncOverrideConfigInput {
                    key: "theme".into(),
                    value: "dark".into(),
                    layer: "user".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        match result {
            ConfigSyncOverrideConfigOutput::Ok { key } => assert_eq!(key, "theme"),
        }

        let record = storage.get("config", "theme").await.unwrap().unwrap();
        assert_eq!(record["value"].as_str().unwrap(), "dark");
        assert_eq!(record["layer"].as_str().unwrap(), "user");
    }

    #[tokio::test]
    async fn override_config_updates_existing_entry() {
        let storage = InMemoryStorage::new();
        let handler = ConfigSyncHandler;

        handler
            .override_config(
                ConfigSyncOverrideConfigInput {
                    key: "theme".into(),
                    value: "light".into(),
                    layer: "default".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        handler
            .override_config(
                ConfigSyncOverrideConfigInput {
                    key: "theme".into(),
                    value: "dark".into(),
                    layer: "user".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        let record = storage.get("config", "theme").await.unwrap().unwrap();
        assert_eq!(record["value"].as_str().unwrap(), "dark");
        assert_eq!(record["layer"].as_str().unwrap(), "user");
    }

    // --- diff ---

    #[tokio::test]
    async fn diff_returns_overridden_configs() {
        let storage = InMemoryStorage::new();
        let handler = ConfigSyncHandler;

        handler
            .override_config(
                ConfigSyncOverrideConfigInput {
                    key: "a".into(),
                    value: "1".into(),
                    layer: "default".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        handler
            .override_config(
                ConfigSyncOverrideConfigInput {
                    key: "b".into(),
                    value: "2".into(),
                    layer: "site".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        let result = handler
            .diff(ConfigSyncDiffInput {}, &storage)
            .await
            .unwrap();

        match result {
            ConfigSyncDiffOutput::Ok { changes } => {
                // Only "b" should appear (layer != "default")
                assert!(changes.contains("\"b\""));
                assert!(!changes.contains("\"a\""));
            }
        }
    }

    #[tokio::test]
    async fn diff_empty_when_all_default() {
        let storage = InMemoryStorage::new();
        let handler = ConfigSyncHandler;

        handler
            .override_config(
                ConfigSyncOverrideConfigInput {
                    key: "x".into(),
                    value: "val".into(),
                    layer: "default".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        let result = handler
            .diff(ConfigSyncDiffInput {}, &storage)
            .await
            .unwrap();

        match result {
            ConfigSyncDiffOutput::Ok { changes } => {
                let parsed: Vec<serde_json::Value> = serde_json::from_str(&changes).unwrap();
                assert!(parsed.is_empty());
            }
        }
    }
}
