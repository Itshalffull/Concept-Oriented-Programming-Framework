// PluginRegistry Concept Implementation (Rust)
//
// Infrastructure kit — registers plugin types and plugin definitions,
// discovers plugins by type, and creates plugin instances.

use crate::storage::{ConceptStorage, StorageResult};
use serde::{Deserialize, Serialize};
use serde_json::json;

// ── RegisterType ──────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginRegistryRegisterTypeInput {
    pub type_id: String,
    pub definition: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum PluginRegistryRegisterTypeOutput {
    #[serde(rename = "ok")]
    Ok { type_id: String },
}

// ── RegisterPlugin ────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginRegistryRegisterPluginInput {
    pub type_id: String,
    pub plugin_id: String,
    pub config: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum PluginRegistryRegisterPluginOutput {
    #[serde(rename = "ok")]
    Ok { type_id: String, plugin_id: String },
    #[serde(rename = "type_notfound")]
    TypeNotFound { message: String },
}

// ── Discover ──────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginRegistryDiscoverInput {
    pub type_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum PluginRegistryDiscoverOutput {
    #[serde(rename = "ok")]
    Ok { type_id: String, plugins: String },
    #[serde(rename = "type_notfound")]
    TypeNotFound { message: String },
}

// ── CreateInstance ─────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginRegistryCreateInstanceInput {
    pub type_id: String,
    pub plugin_id: String,
    pub config: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum PluginRegistryCreateInstanceOutput {
    #[serde(rename = "ok")]
    Ok { instance_id: String },
    #[serde(rename = "notfound")]
    NotFound { message: String },
}

// ── Handler ───────────────────────────────────────────────

pub struct PluginRegistryHandler;

impl PluginRegistryHandler {
    pub async fn register_type(
        &self,
        input: PluginRegistryRegisterTypeInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<PluginRegistryRegisterTypeOutput> {
        let now = chrono::Utc::now().to_rfc3339();
        storage
            .put(
                "plugin_type",
                &input.type_id,
                json!({
                    "type_id": input.type_id,
                    "definition": input.definition,
                    "registered_at": now,
                }),
            )
            .await?;
        Ok(PluginRegistryRegisterTypeOutput::Ok {
            type_id: input.type_id,
        })
    }

    pub async fn register_plugin(
        &self,
        input: PluginRegistryRegisterPluginInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<PluginRegistryRegisterPluginOutput> {
        let type_exists = storage.get("plugin_type", &input.type_id).await?;
        if type_exists.is_none() {
            return Ok(PluginRegistryRegisterPluginOutput::TypeNotFound {
                message: format!("plugin type '{}' not found", input.type_id),
            });
        }

        let key = format!("{}:{}", input.type_id, input.plugin_id);
        let now = chrono::Utc::now().to_rfc3339();
        storage
            .put(
                "plugin_definition",
                &key,
                json!({
                    "type_id": input.type_id,
                    "plugin_id": input.plugin_id,
                    "config": input.config,
                    "registered_at": now,
                }),
            )
            .await?;
        Ok(PluginRegistryRegisterPluginOutput::Ok {
            type_id: input.type_id,
            plugin_id: input.plugin_id,
        })
    }

    pub async fn discover(
        &self,
        input: PluginRegistryDiscoverInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<PluginRegistryDiscoverOutput> {
        let type_exists = storage.get("plugin_type", &input.type_id).await?;
        if type_exists.is_none() {
            return Ok(PluginRegistryDiscoverOutput::TypeNotFound {
                message: format!("plugin type '{}' not found", input.type_id),
            });
        }

        let criteria = json!({ "type_id": input.type_id });
        let plugins = storage
            .find("plugin_definition", Some(&criteria))
            .await?;
        let plugins_json = serde_json::to_string(&plugins)?;

        Ok(PluginRegistryDiscoverOutput::Ok {
            type_id: input.type_id,
            plugins: plugins_json,
        })
    }

    pub async fn create_instance(
        &self,
        input: PluginRegistryCreateInstanceInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<PluginRegistryCreateInstanceOutput> {
        let key = format!("{}:{}", input.type_id, input.plugin_id);
        let plugin = storage.get("plugin_definition", &key).await?;

        if plugin.is_none() {
            return Ok(PluginRegistryCreateInstanceOutput::NotFound {
                message: format!(
                    "plugin '{}' of type '{}' not found",
                    input.plugin_id, input.type_id
                ),
            });
        }

        let instance_id = format!("inst_{}", rand::random::<u32>());
        Ok(PluginRegistryCreateInstanceOutput::Ok { instance_id })
    }
}

// ── Tests ──────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    // ── register_type tests ────────────────────────────────

    #[tokio::test]
    async fn register_type_returns_ok_with_type_id() {
        let storage = InMemoryStorage::new();
        let handler = PluginRegistryHandler;

        let result = handler
            .register_type(
                PluginRegistryRegisterTypeInput {
                    type_id: "auth_plugin".into(),
                    definition: "authentication plugins".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        match result {
            PluginRegistryRegisterTypeOutput::Ok { type_id } => {
                assert_eq!(type_id, "auth_plugin");
            }
        }
    }

    #[tokio::test]
    async fn register_type_stores_in_storage() {
        let storage = InMemoryStorage::new();
        let handler = PluginRegistryHandler;

        handler
            .register_type(
                PluginRegistryRegisterTypeInput {
                    type_id: "cache_plugin".into(),
                    definition: "caching layer plugins".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        let record = storage.get("plugin_type", "cache_plugin").await.unwrap();
        assert!(record.is_some());
        let record = record.unwrap();
        assert_eq!(record["definition"].as_str().unwrap(), "caching layer plugins");
    }

    // ── register_plugin tests ──────────────────────────────

    #[tokio::test]
    async fn register_plugin_succeeds_when_type_exists() {
        let storage = InMemoryStorage::new();
        let handler = PluginRegistryHandler;

        handler
            .register_type(
                PluginRegistryRegisterTypeInput {
                    type_id: "auth".into(),
                    definition: "auth plugins".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        let result = handler
            .register_plugin(
                PluginRegistryRegisterPluginInput {
                    type_id: "auth".into(),
                    plugin_id: "oauth2".into(),
                    config: "{}".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        assert!(matches!(
            result,
            PluginRegistryRegisterPluginOutput::Ok { type_id, plugin_id }
            if type_id == "auth" && plugin_id == "oauth2"
        ));
    }

    #[tokio::test]
    async fn register_plugin_returns_type_notfound_when_type_missing() {
        let storage = InMemoryStorage::new();
        let handler = PluginRegistryHandler;

        let result = handler
            .register_plugin(
                PluginRegistryRegisterPluginInput {
                    type_id: "nonexistent".into(),
                    plugin_id: "p1".into(),
                    config: "{}".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        assert!(matches!(
            result,
            PluginRegistryRegisterPluginOutput::TypeNotFound { .. }
        ));
    }

    // ── discover tests ─────────────────────────────────────

    #[tokio::test]
    async fn discover_returns_plugins_for_type() {
        let storage = InMemoryStorage::new();
        let handler = PluginRegistryHandler;

        handler
            .register_type(
                PluginRegistryRegisterTypeInput {
                    type_id: "storage".into(),
                    definition: "storage backends".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        handler
            .register_plugin(
                PluginRegistryRegisterPluginInput {
                    type_id: "storage".into(),
                    plugin_id: "redis".into(),
                    config: "{}".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        let result = handler
            .discover(
                PluginRegistryDiscoverInput {
                    type_id: "storage".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        match result {
            PluginRegistryDiscoverOutput::Ok { type_id, plugins } => {
                assert_eq!(type_id, "storage");
                let parsed: Vec<serde_json::Value> = serde_json::from_str(&plugins).unwrap();
                assert_eq!(parsed.len(), 1);
            }
            _ => panic!("expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn discover_returns_type_notfound_when_type_missing() {
        let storage = InMemoryStorage::new();
        let handler = PluginRegistryHandler;

        let result = handler
            .discover(
                PluginRegistryDiscoverInput {
                    type_id: "nonexistent".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        assert!(matches!(
            result,
            PluginRegistryDiscoverOutput::TypeNotFound { .. }
        ));
    }

    // ── create_instance tests ──────────────────────────────

    #[tokio::test]
    async fn create_instance_returns_ok_when_plugin_exists() {
        let storage = InMemoryStorage::new();
        let handler = PluginRegistryHandler;

        handler
            .register_type(
                PluginRegistryRegisterTypeInput {
                    type_id: "db".into(),
                    definition: "database plugins".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        handler
            .register_plugin(
                PluginRegistryRegisterPluginInput {
                    type_id: "db".into(),
                    plugin_id: "postgres".into(),
                    config: "{}".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        let result = handler
            .create_instance(
                PluginRegistryCreateInstanceInput {
                    type_id: "db".into(),
                    plugin_id: "postgres".into(),
                    config: "{}".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        assert!(matches!(
            result,
            PluginRegistryCreateInstanceOutput::Ok { instance_id }
            if instance_id.starts_with("inst_")
        ));
    }

    #[tokio::test]
    async fn create_instance_returns_notfound_when_plugin_missing() {
        let storage = InMemoryStorage::new();
        let handler = PluginRegistryHandler;

        let result = handler
            .create_instance(
                PluginRegistryCreateInstanceInput {
                    type_id: "db".into(),
                    plugin_id: "unknown".into(),
                    config: "{}".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        assert!(matches!(
            result,
            PluginRegistryCreateInstanceOutput::NotFound { .. }
        ));
    }
}
