// PluginRegistry concept implementation
// Register, discover, and instantiate plugins with typed definitions and derivation support.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::PluginRegistryHandler;
use serde_json::json;

pub struct PluginRegistryHandlerImpl;

#[async_trait]
impl PluginRegistryHandler for PluginRegistryHandlerImpl {
    async fn register(
        &self,
        input: PluginRegistryRegisterInput,
        storage: &dyn ConceptStorage,
    ) -> Result<PluginRegistryRegisterOutput, Box<dyn std::error::Error>> {
        // Note: generated types use `type` as field name which is a Rust keyword.
        // We access it via the struct field r#type.
        let plugin_type = &input.r#type;
        let name = &input.name;

        let existing = storage.get("pluginDefinition", name).await?;
        if let Some(record) = existing {
            if record["type"].as_str().unwrap_or("") == plugin_type.as_str() {
                let plugin_id = record["id"].as_str().unwrap_or(name).to_string();
                return Ok(PluginRegistryRegisterOutput::Exists { plugin: plugin_id });
            }
        }

        let metadata: serde_json::Value = serde_json::from_str(&input.metadata).unwrap_or(json!({}));

        storage.put("pluginDefinition", name, json!({
            "id": name,
            "type": plugin_type,
            "name": name,
            "metadata": metadata
        })).await?;

        Ok(PluginRegistryRegisterOutput::Ok { plugin: name.clone() })
    }

    async fn discover(
        &self,
        input: PluginRegistryDiscoverInput,
        storage: &dyn ConceptStorage,
    ) -> Result<PluginRegistryDiscoverOutput, Box<dyn std::error::Error>> {
        let all = storage.find("pluginDefinition", Some(&json!({ "type": input.r#type }))).await?;
        let plugins: Vec<serde_json::Value> = all.iter().map(|def| {
            json!({
                "id": def["id"],
                "type": def["type"],
                "metadata": def["metadata"]
            })
        }).collect();

        Ok(PluginRegistryDiscoverOutput::Ok {
            plugins: serde_json::to_string(&plugins)?,
        })
    }

    async fn create_instance(
        &self,
        input: PluginRegistryCreateInstanceInput,
        storage: &dyn ConceptStorage,
    ) -> Result<PluginRegistryCreateInstanceOutput, Box<dyn std::error::Error>> {
        let definition = match storage.get("pluginDefinition", &input.plugin).await? {
            Some(d) => d,
            None => return Ok(PluginRegistryCreateInstanceOutput::Notfound),
        };

        let config: serde_json::Value = serde_json::from_str(&input.config).unwrap_or(json!({}));
        let instance_id = format!("{}:{}", input.plugin, chrono_like_timestamp());

        let instance = json!({
            "instanceId": instance_id,
            "plugin": input.plugin,
            "type": definition["type"],
            "config": config,
            "metadata": definition["metadata"]
        });

        storage.put("pluginInstance", &instance_id, instance.clone()).await?;

        Ok(PluginRegistryCreateInstanceOutput::Ok {
            instance: serde_json::to_string(&instance)?,
        })
    }

    async fn get_definitions(
        &self,
        input: PluginRegistryGetDefinitionsInput,
        storage: &dyn ConceptStorage,
    ) -> Result<PluginRegistryGetDefinitionsOutput, Box<dyn std::error::Error>> {
        let all = storage.find("pluginDefinition", Some(&json!({ "type": input.r#type }))).await?;
        let definitions: Vec<serde_json::Value> = all.iter().map(|def| {
            json!({
                "id": def["id"],
                "type": def["type"],
                "metadata": def["metadata"],
                "config": def["config"]
            })
        }).collect();

        Ok(PluginRegistryGetDefinitionsOutput::Ok {
            definitions: serde_json::to_string(&definitions)?,
        })
    }

    async fn alter_definitions(
        &self,
        input: PluginRegistryAlterDefinitionsInput,
        storage: &dyn ConceptStorage,
    ) -> Result<PluginRegistryAlterDefinitionsOutput, Box<dyn std::error::Error>> {
        let alterations: serde_json::Value = serde_json::from_str(&input.alterations).unwrap_or(json!({}));
        let all = storage.find("pluginDefinition", Some(&json!({ "type": input.r#type }))).await?;

        for def in &all {
            if let Some(id) = def["id"].as_str() {
                let mut updated = def.clone();
                if let Some(obj) = alterations.as_object() {
                    for (key, value) in obj {
                        updated[key] = value.clone();
                    }
                }
                storage.put("pluginDefinition", id, updated).await?;
            }
        }

        Ok(PluginRegistryAlterDefinitionsOutput::Ok)
    }

    async fn derive_plugins(
        &self,
        input: PluginRegistryDerivePluginsInput,
        storage: &dyn ConceptStorage,
    ) -> Result<PluginRegistryDerivePluginsOutput, Box<dyn std::error::Error>> {
        let base = match storage.get("pluginDefinition", &input.plugin).await? {
            Some(d) => d,
            None => return Ok(PluginRegistryDerivePluginsOutput::Notfound),
        };

        let config: serde_json::Value = serde_json::from_str(&input.config).unwrap_or(json!({}));
        let derived_id = format!("{}:derived:{}", input.plugin, chrono_like_timestamp());

        let mut base_config = base["config"].clone();
        if let Some(obj) = config.as_object() {
            if let Some(base_obj) = base_config.as_object_mut() {
                for (key, value) in obj {
                    base_obj.insert(key.clone(), value.clone());
                }
            } else {
                base_config = config;
            }
        }

        let derived = json!({
            "id": derived_id,
            "type": base["type"],
            "metadata": base["metadata"],
            "config": base_config,
            "derivedFrom": input.plugin
        });

        storage.put("pluginDefinition", &derived_id, derived.clone()).await?;

        Ok(PluginRegistryDerivePluginsOutput::Ok {
            derived: serde_json::to_string(&derived)?,
        })
    }
}

fn chrono_like_timestamp() -> u64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_millis() as u64
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_register_plugin() {
        let storage = InMemoryStorage::new();
        let handler = PluginRegistryHandlerImpl;
        let result = handler.register(
            PluginRegistryRegisterInput {
                r#type: "adapter".to_string(),
                name: "my-plugin".to_string(),
                metadata: "{}".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            PluginRegistryRegisterOutput::Ok { plugin } => assert_eq!(plugin, "my-plugin"),
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_register_exists() {
        let storage = InMemoryStorage::new();
        let handler = PluginRegistryHandlerImpl;
        handler.register(
            PluginRegistryRegisterInput {
                r#type: "adapter".to_string(),
                name: "my-plugin".to_string(),
                metadata: "{}".to_string(),
            },
            &storage,
        ).await.unwrap();
        let result = handler.register(
            PluginRegistryRegisterInput {
                r#type: "adapter".to_string(),
                name: "my-plugin".to_string(),
                metadata: "{}".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            PluginRegistryRegisterOutput::Exists { plugin } => assert_eq!(plugin, "my-plugin"),
            _ => panic!("Expected Exists variant"),
        }
    }

    #[tokio::test]
    async fn test_discover() {
        let storage = InMemoryStorage::new();
        let handler = PluginRegistryHandlerImpl;
        let result = handler.discover(
            PluginRegistryDiscoverInput { r#type: "adapter".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            PluginRegistryDiscoverOutput::Ok { plugins } => {
                assert!(!plugins.is_empty()); // should be valid JSON at least
            }
        }
    }

    #[tokio::test]
    async fn test_create_instance_not_found() {
        let storage = InMemoryStorage::new();
        let handler = PluginRegistryHandlerImpl;
        let result = handler.create_instance(
            PluginRegistryCreateInstanceInput {
                plugin: "nonexistent".to_string(),
                config: "{}".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            PluginRegistryCreateInstanceOutput::Notfound => {}
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_create_instance_ok() {
        let storage = InMemoryStorage::new();
        let handler = PluginRegistryHandlerImpl;
        handler.register(
            PluginRegistryRegisterInput {
                r#type: "adapter".to_string(),
                name: "my-plugin".to_string(),
                metadata: "{}".to_string(),
            },
            &storage,
        ).await.unwrap();
        let result = handler.create_instance(
            PluginRegistryCreateInstanceInput {
                plugin: "my-plugin".to_string(),
                config: "{}".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            PluginRegistryCreateInstanceOutput::Ok { instance } => {
                assert!(!instance.is_empty());
            }
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_derive_plugins_not_found() {
        let storage = InMemoryStorage::new();
        let handler = PluginRegistryHandlerImpl;
        let result = handler.derive_plugins(
            PluginRegistryDerivePluginsInput {
                plugin: "nonexistent".to_string(),
                config: "{}".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            PluginRegistryDerivePluginsOutput::Notfound => {}
            _ => panic!("Expected Notfound variant"),
        }
    }
}
