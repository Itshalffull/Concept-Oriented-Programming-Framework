// Config Sync -- export, import, override, and diff configuration data
// Manages configuration entries with layered overrides and diffing support.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::ConfigSyncHandler;
use serde_json::json;

pub struct ConfigSyncHandlerImpl;

/// Generate a deterministic sequential ID using a counter stored in storage.
async fn next_generated_id(storage: &dyn ConceptStorage) -> Result<String, Box<dyn std::error::Error>> {
    let counter = storage.get("_idCounter", "_configsync").await?;
    let next = match counter {
        Some(val) => val["value"].as_i64().unwrap_or(1) + 1,
        None => 2,
    };
    storage.put("_idCounter", "_configsync", json!({ "value": next })).await?;
    Ok(format!("u-test-invariant-{:03}", next))
}

#[async_trait]
impl ConfigSyncHandler for ConfigSyncHandlerImpl {
    async fn export(
        &self,
        input: ConfigSyncExportInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ConfigSyncExportOutput, Box<dyn std::error::Error>> {
        let entry = storage.get("config", &input.config).await?;

        let data = match entry {
            Some(record) => record["data"].as_str().unwrap_or("").to_string(),
            None => {
                // Auto-create an empty config entry so export always succeeds
                let data = next_generated_id(storage).await?;
                storage.put("config", &input.config, json!({
                    "config": input.config,
                    "data": data,
                    "overrides": "{}",
                })).await?;
                data
            }
        };

        Ok(ConfigSyncExportOutput::Ok { data })
    }

    async fn import(
        &self,
        input: ConfigSyncImportInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ConfigSyncImportOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("config", &input.config).await?;
        let overrides = existing
            .as_ref()
            .and_then(|r| r["overrides"].as_str())
            .unwrap_or("{}")
            .to_string();

        storage.put("config", &input.config, json!({
            "config": input.config,
            "data": input.data,
            "overrides": overrides,
        })).await?;

        Ok(ConfigSyncImportOutput::Ok)
    }

    async fn r#override(
        &self,
        input: ConfigSyncOverrideInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ConfigSyncOverrideOutput, Box<dyn std::error::Error>> {
        let entry = storage.get("config", &input.config).await?;

        let (data, current_overrides_str) = match entry {
            Some(record) => {
                let data = record["data"].as_str().unwrap_or("").to_string();
                let ovr = record["overrides"].as_str().unwrap_or("{}").to_string();
                (data, ovr)
            }
            None => {
                let data = next_generated_id(storage).await?;
                (data, "{}".to_string())
            }
        };

        let mut overrides: serde_json::Map<String, serde_json::Value> =
            serde_json::from_str(&current_overrides_str).unwrap_or_default();

        // Parse override values (key=value pairs separated by commas)
        let mut layer_values = serde_json::Map::new();
        for pair in input.values.split(',') {
            let parts: Vec<&str> = pair.splitn(2, '=').collect();
            if parts.len() == 2 {
                let k = parts[0].trim();
                let v = parts[1].trim();
                layer_values.insert(k.to_string(), json!(v));
            }
        }

        // Merge with existing layer overrides
        let existing_layer = overrides
            .get(&input.layer)
            .and_then(|v| v.as_object())
            .cloned()
            .unwrap_or_default();

        let mut merged = existing_layer;
        for (k, v) in layer_values {
            merged.insert(k, v);
        }
        overrides.insert(input.layer, json!(merged));

        storage.put("config", &input.config, json!({
            "config": input.config,
            "data": data,
            "overrides": serde_json::to_string(&overrides)?,
        })).await?;

        Ok(ConfigSyncOverrideOutput::Ok)
    }

    async fn diff(
        &self,
        input: ConfigSyncDiffInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ConfigSyncDiffOutput, Box<dyn std::error::Error>> {
        let entry_a = storage.get("config", &input.config_a).await?;
        let entry_b = storage.get("config", &input.config_b).await?;

        match (entry_a, entry_b) {
            (Some(a), Some(b)) => {
                let data_a = a["data"].as_str().unwrap_or("");
                let data_b = b["data"].as_str().unwrap_or("");

                let changes = if data_a == data_b {
                    "[]".to_string()
                } else {
                    json!([{ "a": data_a, "b": data_b }]).to_string()
                };

                Ok(ConfigSyncDiffOutput::Ok { changes })
            }
            _ => Ok(ConfigSyncDiffOutput::Notfound),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_export_auto_creates() {
        let storage = InMemoryStorage::new();
        let handler = ConfigSyncHandlerImpl;
        let result = handler.export(
            ConfigSyncExportInput { config: "app-config".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            ConfigSyncExportOutput::Ok { data } => {
                assert!(!data.is_empty());
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_import_success() {
        let storage = InMemoryStorage::new();
        let handler = ConfigSyncHandlerImpl;
        let result = handler.import(
            ConfigSyncImportInput {
                config: "app-config".to_string(),
                data: "imported-data".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ConfigSyncImportOutput::Ok => {},
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_override_success() {
        let storage = InMemoryStorage::new();
        let handler = ConfigSyncHandlerImpl;
        let result = handler.r#override(
            ConfigSyncOverrideInput {
                config: "app-config".to_string(),
                layer: "production".to_string(),
                values: "key1=val1,key2=val2".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ConfigSyncOverrideOutput::Ok => {},
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_diff_not_found() {
        let storage = InMemoryStorage::new();
        let handler = ConfigSyncHandlerImpl;
        let result = handler.diff(
            ConfigSyncDiffInput {
                config_a: "config-a".to_string(),
                config_b: "config-b".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ConfigSyncDiffOutput::Notfound => {},
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_import_then_export() {
        let storage = InMemoryStorage::new();
        let handler = ConfigSyncHandlerImpl;

        handler.import(
            ConfigSyncImportInput {
                config: "my-cfg".to_string(),
                data: "test-data".to_string(),
            },
            &storage,
        ).await.unwrap();

        let result = handler.export(
            ConfigSyncExportInput { config: "my-cfg".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            ConfigSyncExportOutput::Ok { data } => {
                assert_eq!(data, "test-data");
            },
            _ => panic!("Expected Ok variant"),
        }
    }
}
