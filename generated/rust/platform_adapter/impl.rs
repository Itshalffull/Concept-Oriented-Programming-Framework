// PlatformAdapter concept implementation
// Detect target platform and delegate normalization to platform-specific adapters.
// Supports web, mobile, desktop, watch, and terminal platforms.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::PlatformAdapterHandler;
use serde_json::json;
use std::collections::HashMap;

pub struct PlatformAdapterHandlerImpl;

fn platform_adapter_map() -> HashMap<&'static str, &'static str> {
    let mut m = HashMap::new();
    m.insert("web", "browser-adapter");
    m.insert("browser", "browser-adapter");
    m.insert("mobile", "mobile-adapter");
    m.insert("ios", "mobile-adapter");
    m.insert("android", "mobile-adapter");
    m.insert("desktop", "desktop-adapter");
    m.insert("electron", "desktop-adapter");
    m.insert("tauri", "desktop-adapter");
    m.insert("watch", "watch-adapter");
    m.insert("watchos", "watch-adapter");
    m.insert("terminal", "terminal-adapter");
    m.insert("cli", "terminal-adapter");
    m
}

#[async_trait]
impl PlatformAdapterHandler for PlatformAdapterHandlerImpl {
    async fn register(
        &self,
        input: PlatformAdapterRegisterInput,
        storage: &dyn ConceptStorage,
    ) -> Result<PlatformAdapterRegisterOutput, Box<dyn std::error::Error>> {
        // Check for duplicate registration
        let existing = storage.get("platform-adapter", &input.adapter).await?;
        if existing.is_some() {
            return Ok(PlatformAdapterRegisterOutput::Duplicate {
                message: format!("Adapter '{}' already registered", input.adapter),
            });
        }

        storage.put("platform-adapter", &input.adapter, json!({
            "adapter": input.adapter,
            "platform": input.platform,
            "config": input.config
        })).await?;

        Ok(PlatformAdapterRegisterOutput::Ok { adapter: input.adapter })
    }

    async fn map_navigation(
        &self,
        input: PlatformAdapterMapNavigationInput,
        storage: &dyn ConceptStorage,
    ) -> Result<PlatformAdapterMapNavigationOutput, Box<dyn std::error::Error>> {
        let record = match storage.get("platform-adapter", &input.adapter).await? {
            Some(r) => r,
            None => return Ok(PlatformAdapterMapNavigationOutput::Unsupported {
                message: format!("Adapter '{}' not found", input.adapter),
            }),
        };

        let platform = record["platform"].as_str().unwrap_or("").to_lowercase();
        let map = platform_adapter_map();

        let platform_action = if map.contains_key(platform.as_str()) {
            format!("navigate:{}", input.transition)
        } else {
            return Ok(PlatformAdapterMapNavigationOutput::Unsupported {
                message: format!("Platform '{}' navigation not supported", platform),
            });
        };

        Ok(PlatformAdapterMapNavigationOutput::Ok {
            adapter: input.adapter,
            platform_action,
        })
    }

    async fn map_zone(
        &self,
        input: PlatformAdapterMapZoneInput,
        storage: &dyn ConceptStorage,
    ) -> Result<PlatformAdapterMapZoneOutput, Box<dyn std::error::Error>> {
        let record = match storage.get("platform-adapter", &input.adapter).await? {
            Some(r) => r,
            None => return Ok(PlatformAdapterMapZoneOutput::Unmapped {
                message: format!("Adapter '{}' not found", input.adapter),
            }),
        };

        let platform_config = json!({
            "role": input.role,
            "platform": record["platform"],
            "config": record["config"]
        });

        Ok(PlatformAdapterMapZoneOutput::Ok {
            adapter: input.adapter,
            platform_config: serde_json::to_string(&platform_config)?,
        })
    }

    async fn handle_platform_event(
        &self,
        input: PlatformAdapterHandlePlatformEventInput,
        storage: &dyn ConceptStorage,
    ) -> Result<PlatformAdapterHandlePlatformEventOutput, Box<dyn std::error::Error>> {
        let record = match storage.get("platform-adapter", &input.adapter).await? {
            Some(r) => r,
            None => return Ok(PlatformAdapterHandlePlatformEventOutput::Ignored {
                message: format!("Adapter '{}' not found", input.adapter),
            }),
        };

        let platform = record["platform"].as_str().unwrap_or("");
        let map = platform_adapter_map();

        if !map.contains_key(platform.to_lowercase().as_str()) {
            return Ok(PlatformAdapterHandlePlatformEventOutput::Ignored {
                message: format!("Event from unknown platform '{}'", platform),
            });
        }

        let action = format!("handle:{}:{}", platform, input.event);

        Ok(PlatformAdapterHandlePlatformEventOutput::Ok {
            adapter: input.adapter,
            action,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_register_adapter() {
        let storage = InMemoryStorage::new();
        let handler = PlatformAdapterHandlerImpl;
        let result = handler.register(
            PlatformAdapterRegisterInput {
                adapter: "web-adapter".to_string(),
                platform: "web".to_string(),
                config: "{}".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            PlatformAdapterRegisterOutput::Ok { adapter } => assert_eq!(adapter, "web-adapter"),
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_register_duplicate() {
        let storage = InMemoryStorage::new();
        let handler = PlatformAdapterHandlerImpl;
        handler.register(
            PlatformAdapterRegisterInput {
                adapter: "web-adapter".to_string(),
                platform: "web".to_string(),
                config: "{}".to_string(),
            },
            &storage,
        ).await.unwrap();
        let result = handler.register(
            PlatformAdapterRegisterInput {
                adapter: "web-adapter".to_string(),
                platform: "web".to_string(),
                config: "{}".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            PlatformAdapterRegisterOutput::Duplicate { .. } => {}
            _ => panic!("Expected Duplicate variant"),
        }
    }

    #[tokio::test]
    async fn test_map_navigation() {
        let storage = InMemoryStorage::new();
        let handler = PlatformAdapterHandlerImpl;
        handler.register(
            PlatformAdapterRegisterInput {
                adapter: "web-adapter".to_string(),
                platform: "web".to_string(),
                config: "{}".to_string(),
            },
            &storage,
        ).await.unwrap();
        let result = handler.map_navigation(
            PlatformAdapterMapNavigationInput {
                adapter: "web-adapter".to_string(),
                transition: "push".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            PlatformAdapterMapNavigationOutput::Ok { platform_action, .. } => {
                assert!(platform_action.contains("navigate"));
            }
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_map_navigation_unsupported() {
        let storage = InMemoryStorage::new();
        let handler = PlatformAdapterHandlerImpl;
        let result = handler.map_navigation(
            PlatformAdapterMapNavigationInput {
                adapter: "nonexistent".to_string(),
                transition: "push".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            PlatformAdapterMapNavigationOutput::Unsupported { .. } => {}
            _ => panic!("Expected Unsupported variant"),
        }
    }

    #[tokio::test]
    async fn test_handle_platform_event_ignored() {
        let storage = InMemoryStorage::new();
        let handler = PlatformAdapterHandlerImpl;
        let result = handler.handle_platform_event(
            PlatformAdapterHandlePlatformEventInput {
                adapter: "nonexistent".to_string(),
                event: "click".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            PlatformAdapterHandlePlatformEventOutput::Ignored { .. } => {}
            _ => panic!("Expected Ignored variant"),
        }
    }
}
