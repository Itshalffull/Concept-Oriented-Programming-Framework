// DesignTokenProvider concept implementation
// Manages design tokens (colors, spacing, typography) for UI generation.
// Supports theme switching, token resolution, and export to multiple formats.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::DesignTokenProviderHandler;
use serde_json::json;
use std::sync::atomic::{AtomicU64, Ordering};

pub struct DesignTokenProviderHandlerImpl {
    counter: AtomicU64,
}

impl DesignTokenProviderHandlerImpl {
    pub fn new() -> Self {
        Self {
            counter: AtomicU64::new(0),
        }
    }
}

#[async_trait]
impl DesignTokenProviderHandler for DesignTokenProviderHandlerImpl {
    async fn initialize(
        &self,
        input: DesignTokenProviderInitializeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DesignTokenProviderInitializeOutput, Box<dyn std::error::Error>> {
        let plugin_ref = "surface-provider:design-token".to_string();

        let existing = storage
            .find("plugin_definition", Some(&json!({ "pluginRef": plugin_ref })))
            .await?;
        if !existing.is_empty() {
            let rec = &existing[0];
            return Ok(DesignTokenProviderInitializeOutput::Ok {
                instance: rec["instance"].as_str().unwrap_or("").to_string(),
                plugin_ref,
            });
        }

        if input.config.is_empty() {
            return Ok(DesignTokenProviderInitializeOutput::ConfigError {
                message: "config must not be empty".to_string(),
            });
        }

        let id = self.counter.fetch_add(1, Ordering::SeqCst);
        let instance = format!("design-token-{}", id);

        storage
            .put(
                "design_token_provider",
                &instance,
                json!({
                    "instance": instance,
                    "pluginRef": plugin_ref,
                    "config": input.config,
                }),
            )
            .await?;

        storage
            .put(
                "plugin_definition",
                &plugin_ref,
                json!({
                    "pluginRef": plugin_ref,
                    "instance": instance,
                    "type": "design-token-provider",
                }),
            )
            .await?;

        Ok(DesignTokenProviderInitializeOutput::Ok {
            instance,
            plugin_ref,
        })
    }

    async fn resolve(
        &self,
        input: DesignTokenProviderResolveInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DesignTokenProviderResolveOutput, Box<dyn std::error::Error>> {
        let key = format!("{}:{}", input.theme, input.token_name);
        let record = storage.get("design_token", &key).await?;

        match record {
            Some(rec) => Ok(DesignTokenProviderResolveOutput::Ok {
                token_name: input.token_name,
                value: rec["value"].as_str().unwrap_or("").to_string(),
            }),
            None => Ok(DesignTokenProviderResolveOutput::NotFound {
                message: format!("token '{}' not found in theme '{}'", input.token_name, input.theme),
            }),
        }
    }

    async fn switch_theme(
        &self,
        input: DesignTokenProviderSwitchThemeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DesignTokenProviderSwitchThemeOutput, Box<dyn std::error::Error>> {
        let theme_record = storage.get("design_token_theme", &input.theme).await?;

        if theme_record.is_none() {
            return Ok(DesignTokenProviderSwitchThemeOutput::NotFound {
                message: format!("theme '{}' not found", input.theme),
            });
        }

        storage
            .put("design_token_active_theme", "current", json!({ "theme": input.theme }))
            .await?;

        Ok(DesignTokenProviderSwitchThemeOutput::Ok {
            theme: input.theme,
        })
    }

    async fn get_tokens(
        &self,
        input: DesignTokenProviderGetTokensInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DesignTokenProviderGetTokensOutput, Box<dyn std::error::Error>> {
        let criteria = json!({ "theme": input.theme, "category": input.category });
        let tokens = storage.find("design_token", Some(&criteria)).await?;
        let tokens_json = serde_json::to_string(&tokens)?;

        Ok(DesignTokenProviderGetTokensOutput::Ok { tokens: tokens_json })
    }

    async fn export(
        &self,
        input: DesignTokenProviderExportInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DesignTokenProviderExportOutput, Box<dyn std::error::Error>> {
        let criteria = json!({ "theme": input.theme });
        let tokens = storage.find("design_token", Some(&criteria)).await?;
        let payload = serde_json::to_string(&tokens)?;

        Ok(DesignTokenProviderExportOutput::Ok {
            format: input.format,
            payload,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_initialize_creates_instance() {
        let storage = InMemoryStorage::new();
        let handler = DesignTokenProviderHandlerImpl::new();
        let result = handler.initialize(
            DesignTokenProviderInitializeInput { config: "{}".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            DesignTokenProviderInitializeOutput::Ok { instance, plugin_ref } => {
                assert!(instance.starts_with("design-token-"));
                assert_eq!(plugin_ref, "surface-provider:design-token");
            }
            _ => panic!("expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_initialize_is_idempotent() {
        let storage = InMemoryStorage::new();
        let handler = DesignTokenProviderHandlerImpl::new();
        let first = handler.initialize(
            DesignTokenProviderInitializeInput { config: "{}".to_string() },
            &storage,
        ).await.unwrap();
        let second = handler.initialize(
            DesignTokenProviderInitializeInput { config: "{}".to_string() },
            &storage,
        ).await.unwrap();
        let (i1, i2) = match (&first, &second) {
            (DesignTokenProviderInitializeOutput::Ok { instance: i1, .. },
             DesignTokenProviderInitializeOutput::Ok { instance: i2, .. }) => (i1.clone(), i2.clone()),
            _ => panic!("expected Ok variants"),
        };
        assert_eq!(i1, i2);
    }

    #[tokio::test]
    async fn test_initialize_config_error() {
        let storage = InMemoryStorage::new();
        let handler = DesignTokenProviderHandlerImpl::new();
        let result = handler.initialize(
            DesignTokenProviderInitializeInput { config: "".to_string() },
            &storage,
        ).await.unwrap();
        assert!(matches!(result, DesignTokenProviderInitializeOutput::ConfigError { .. }));
    }

    #[tokio::test]
    async fn test_resolve_found() {
        let storage = InMemoryStorage::new();
        let handler = DesignTokenProviderHandlerImpl::new();
        storage.put("design_token", "light:primary", json!({
            "theme": "light", "category": "color", "value": "#3366ff"
        })).await.unwrap();
        let result = handler.resolve(
            DesignTokenProviderResolveInput { token_name: "primary".to_string(), theme: "light".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            DesignTokenProviderResolveOutput::Ok { value, .. } => assert_eq!(value, "#3366ff"),
            _ => panic!("expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_resolve_not_found() {
        let storage = InMemoryStorage::new();
        let handler = DesignTokenProviderHandlerImpl::new();
        let result = handler.resolve(
            DesignTokenProviderResolveInput { token_name: "missing".to_string(), theme: "light".to_string() },
            &storage,
        ).await.unwrap();
        assert!(matches!(result, DesignTokenProviderResolveOutput::NotFound { .. }));
    }

    #[tokio::test]
    async fn test_export_returns_payload() {
        let storage = InMemoryStorage::new();
        let handler = DesignTokenProviderHandlerImpl::new();
        storage.put("design_token", "dark:bg", json!({
            "theme": "dark", "category": "color", "value": "#111"
        })).await.unwrap();
        let result = handler.export(
            DesignTokenProviderExportInput { theme: "dark".to_string(), format: "json".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            DesignTokenProviderExportOutput::Ok { format, payload } => {
                assert_eq!(format, "json");
                assert!(!payload.is_empty());
            }
        }
    }
}
