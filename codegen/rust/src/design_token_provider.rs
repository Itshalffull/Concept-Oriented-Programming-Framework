// DesignTokenProvider Concept Implementation (Rust)
//
// Surface Provider — manages design tokens (colors, spacing, typography, etc.)
// for UI generation. Resolves tokens by name, supports theme switching,
// and exports token sets for downstream consumers.

use crate::storage::{ConceptStorage, StorageResult};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::atomic::{AtomicU64, Ordering};

// ── Initialize ──────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct InitializeInput {
    pub config: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum InitializeOutput {
    #[serde(rename = "ok")]
    Ok { instance: String, plugin_ref: String },
    #[serde(rename = "config_error")]
    ConfigError { message: String },
}

// ── Resolve ─────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ResolveInput {
    pub token_name: String,
    pub theme: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ResolveOutput {
    #[serde(rename = "ok")]
    Ok { token_name: String, value: String },
    #[serde(rename = "not_found")]
    NotFound { message: String },
}

// ── SwitchTheme ─────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SwitchThemeInput {
    pub theme: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum SwitchThemeOutput {
    #[serde(rename = "ok")]
    Ok { theme: String },
    #[serde(rename = "not_found")]
    NotFound { message: String },
}

// ── GetTokens ───────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct GetTokensInput {
    pub theme: String,
    pub category: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum GetTokensOutput {
    #[serde(rename = "ok")]
    Ok { tokens: String },
}

// ── Export ───────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ExportInput {
    pub theme: String,
    pub format: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ExportOutput {
    #[serde(rename = "ok")]
    Ok { format: String, payload: String },
}

// ── Handler ─────────────────────────────────────────────

pub struct DesignTokenProviderHandler {
    counter: AtomicU64,
}

impl DesignTokenProviderHandler {
    pub fn new() -> Self {
        Self {
            counter: AtomicU64::new(0),
        }
    }

    pub async fn initialize(
        &self,
        input: InitializeInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<InitializeOutput> {
        let plugin_ref = "surface-provider:design-token".to_string();

        // Idempotent: check for existing registration
        let existing = storage
            .find("plugin_definition", Some(&json!({ "pluginRef": plugin_ref })))
            .await?;
        if !existing.is_empty() {
            let rec = &existing[0];
            return Ok(InitializeOutput::Ok {
                instance: rec["instance"].as_str().unwrap_or("").to_string(),
                plugin_ref,
            });
        }

        if input.config.is_empty() {
            return Ok(InitializeOutput::ConfigError {
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

        Ok(InitializeOutput::Ok {
            instance,
            plugin_ref,
        })
    }

    pub async fn resolve(
        &self,
        input: ResolveInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<ResolveOutput> {
        let key = format!("{}:{}", input.theme, input.token_name);
        let record = storage.get("design_token", &key).await?;

        match record {
            Some(rec) => Ok(ResolveOutput::Ok {
                token_name: input.token_name,
                value: rec["value"].as_str().unwrap_or("").to_string(),
            }),
            None => Ok(ResolveOutput::NotFound {
                message: format!(
                    "token '{}' not found in theme '{}'",
                    input.token_name, input.theme
                ),
            }),
        }
    }

    pub async fn switch_theme(
        &self,
        input: SwitchThemeInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<SwitchThemeOutput> {
        let theme_record = storage.get("design_token_theme", &input.theme).await?;

        if theme_record.is_none() {
            return Ok(SwitchThemeOutput::NotFound {
                message: format!("theme '{}' not found", input.theme),
            });
        }

        storage
            .put(
                "design_token_active_theme",
                "current",
                json!({ "theme": input.theme }),
            )
            .await?;

        Ok(SwitchThemeOutput::Ok {
            theme: input.theme,
        })
    }

    pub async fn get_tokens(
        &self,
        input: GetTokensInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<GetTokensOutput> {
        let criteria = json!({ "theme": input.theme, "category": input.category });
        let tokens = storage
            .find("design_token", Some(&criteria))
            .await?;
        let tokens_json = serde_json::to_string(&tokens)?;

        Ok(GetTokensOutput::Ok {
            tokens: tokens_json,
        })
    }

    pub async fn export(
        &self,
        input: ExportInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<ExportOutput> {
        let criteria = json!({ "theme": input.theme });
        let tokens = storage
            .find("design_token", Some(&criteria))
            .await?;
        let payload = serde_json::to_string(&tokens)?;

        Ok(ExportOutput::Ok {
            format: input.format,
            payload,
        })
    }
}

// ── Tests ───────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn initialize_creates_instance_and_plugin_ref() {
        let storage = InMemoryStorage::new();
        let handler = DesignTokenProviderHandler::new();

        let result = handler
            .initialize(
                InitializeInput {
                    config: r#"{"themes":["light","dark"]}"#.into(),
                },
                &storage,
            )
            .await
            .unwrap();

        match result {
            InitializeOutput::Ok { instance, plugin_ref } => {
                assert!(instance.starts_with("design-token-"));
                assert_eq!(plugin_ref, "surface-provider:design-token");
            }
            _ => panic!("expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn initialize_is_idempotent() {
        let storage = InMemoryStorage::new();
        let handler = DesignTokenProviderHandler::new();

        let first = handler
            .initialize(
                InitializeInput { config: "{}".into() },
                &storage,
            )
            .await
            .unwrap();

        let second = handler
            .initialize(
                InitializeInput { config: "{}".into() },
                &storage,
            )
            .await
            .unwrap();

        let (i1, i2) = match (&first, &second) {
            (
                InitializeOutput::Ok { instance: i1, .. },
                InitializeOutput::Ok { instance: i2, .. },
            ) => (i1.clone(), i2.clone()),
            _ => panic!("expected Ok variants"),
        };
        assert_eq!(i1, i2);
    }

    #[tokio::test]
    async fn initialize_returns_config_error_on_empty_config() {
        let storage = InMemoryStorage::new();
        let handler = DesignTokenProviderHandler::new();

        let result = handler
            .initialize(
                InitializeInput { config: "".into() },
                &storage,
            )
            .await
            .unwrap();

        assert!(matches!(result, InitializeOutput::ConfigError { .. }));
    }

    #[tokio::test]
    async fn resolve_returns_token_value() {
        let storage = InMemoryStorage::new();
        let handler = DesignTokenProviderHandler::new();

        storage
            .put(
                "design_token",
                "light:primary-color",
                json!({ "theme": "light", "category": "color", "value": "#3366ff" }),
            )
            .await
            .unwrap();

        let result = handler
            .resolve(
                ResolveInput {
                    token_name: "primary-color".into(),
                    theme: "light".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        match result {
            ResolveOutput::Ok { token_name, value } => {
                assert_eq!(token_name, "primary-color");
                assert_eq!(value, "#3366ff");
            }
            _ => panic!("expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn resolve_returns_not_found_for_missing_token() {
        let storage = InMemoryStorage::new();
        let handler = DesignTokenProviderHandler::new();

        let result = handler
            .resolve(
                ResolveInput {
                    token_name: "missing".into(),
                    theme: "light".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        assert!(matches!(result, ResolveOutput::NotFound { .. }));
    }

    #[tokio::test]
    async fn switch_theme_succeeds_when_theme_exists() {
        let storage = InMemoryStorage::new();
        let handler = DesignTokenProviderHandler::new();

        storage
            .put("design_token_theme", "dark", json!({ "name": "dark" }))
            .await
            .unwrap();

        let result = handler
            .switch_theme(
                SwitchThemeInput { theme: "dark".into() },
                &storage,
            )
            .await
            .unwrap();

        match result {
            SwitchThemeOutput::Ok { theme } => assert_eq!(theme, "dark"),
            _ => panic!("expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn switch_theme_returns_not_found_for_missing_theme() {
        let storage = InMemoryStorage::new();
        let handler = DesignTokenProviderHandler::new();

        let result = handler
            .switch_theme(
                SwitchThemeInput { theme: "neon".into() },
                &storage,
            )
            .await
            .unwrap();

        assert!(matches!(result, SwitchThemeOutput::NotFound { .. }));
    }

    #[tokio::test]
    async fn get_tokens_returns_filtered_tokens() {
        let storage = InMemoryStorage::new();
        let handler = DesignTokenProviderHandler::new();

        storage
            .put(
                "design_token",
                "light:spacing-sm",
                json!({ "theme": "light", "category": "spacing", "value": "4px" }),
            )
            .await
            .unwrap();

        let result = handler
            .get_tokens(
                GetTokensInput {
                    theme: "light".into(),
                    category: "spacing".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        match result {
            GetTokensOutput::Ok { tokens } => {
                let parsed: Vec<serde_json::Value> = serde_json::from_str(&tokens).unwrap();
                assert_eq!(parsed.len(), 1);
            }
        }
    }

    #[tokio::test]
    async fn export_returns_all_tokens_for_theme() {
        let storage = InMemoryStorage::new();
        let handler = DesignTokenProviderHandler::new();

        storage
            .put(
                "design_token",
                "dark:bg",
                json!({ "theme": "dark", "category": "color", "value": "#111" }),
            )
            .await
            .unwrap();

        let result = handler
            .export(
                ExportInput {
                    theme: "dark".into(),
                    format: "json".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        match result {
            ExportOutput::Ok { format, payload } => {
                assert_eq!(format, "json");
                assert!(!payload.is_empty());
            }
        }
    }
}
