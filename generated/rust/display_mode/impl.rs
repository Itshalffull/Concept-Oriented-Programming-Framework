// DisplayMode Handler Implementation
//
// Define display modes with per-field display and form configurations.
// Render entities using mode-specific applied configs.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::DisplayModeHandler;
use serde_json::json;

pub struct DisplayModeHandlerImpl;

#[async_trait]
impl DisplayModeHandler for DisplayModeHandlerImpl {
    async fn define_mode(
        &self,
        input: DisplayModeDefineModeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DisplayModeDefineModeOutput, Box<dyn std::error::Error>> {
        let all_modes = storage.find("displayMode", Some(&json!({"name": input.name}))).await?;
        if !all_modes.is_empty() {
            return Ok(DisplayModeDefineModeOutput::Exists {
                message: format!("A mode with name \"{}\" already exists", input.name),
            });
        }

        storage.put("displayMode", &input.mode, json!({
            "mode": input.mode,
            "name": input.name,
            "fieldDisplayConfigs": "{}",
            "fieldFormConfigs": "{}",
        })).await?;

        Ok(DisplayModeDefineModeOutput::Ok { mode: input.mode })
    }

    async fn configure_field_display(
        &self,
        input: DisplayModeConfigureFieldDisplayInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DisplayModeConfigureFieldDisplayOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("displayMode", &input.mode).await?;
        let existing = match existing {
            Some(e) => e,
            None => {
                // Auto-create mode when configuring
                let new_mode = json!({
                    "mode": input.mode,
                    "name": input.mode,
                    "fieldDisplayConfigs": "{}",
                    "fieldFormConfigs": "{}",
                });
                storage.put("displayMode", &input.mode, new_mode.clone()).await?;
                new_mode
            }
        };

        let configs_str = existing.get("fieldDisplayConfigs").and_then(|v| v.as_str()).unwrap_or("{}");
        let mut configs: serde_json::Map<String, serde_json::Value> = serde_json::from_str(configs_str).unwrap_or_default();
        configs.insert(input.field, json!(input.config));

        let mut updated = existing.clone();
        updated["fieldDisplayConfigs"] = json!(serde_json::to_string(&configs)?);
        storage.put("displayMode", &input.mode, updated).await?;

        Ok(DisplayModeConfigureFieldDisplayOutput::Ok { mode: input.mode })
    }

    async fn configure_field_form(
        &self,
        input: DisplayModeConfigureFieldFormInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DisplayModeConfigureFieldFormOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("displayMode", &input.mode).await?;
        let existing = match existing {
            Some(e) => e,
            None => return Ok(DisplayModeConfigureFieldFormOutput::Notfound {
                message: "Display mode not found".to_string(),
            }),
        };

        let configs_str = existing.get("fieldFormConfigs").and_then(|v| v.as_str()).unwrap_or("{}");
        let mut configs: serde_json::Map<String, serde_json::Value> = serde_json::from_str(configs_str).unwrap_or_default();
        configs.insert(input.field, json!(input.config));

        let mut updated = existing.clone();
        updated["fieldFormConfigs"] = json!(serde_json::to_string(&configs)?);
        storage.put("displayMode", &input.mode, updated).await?;

        Ok(DisplayModeConfigureFieldFormOutput::Ok { mode: input.mode })
    }

    async fn render_in_mode(
        &self,
        input: DisplayModeRenderInModeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DisplayModeRenderInModeOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("displayMode", &input.mode).await?;
        let existing = match existing {
            Some(e) => e,
            None => return Ok(DisplayModeRenderInModeOutput::Notfound {
                message: "Display mode not found".to_string(),
            }),
        };

        let display_configs_str = existing.get("fieldDisplayConfigs").and_then(|v| v.as_str()).unwrap_or("{}");
        let display_configs: serde_json::Value = serde_json::from_str(display_configs_str).unwrap_or(json!({}));

        let output = json!({
            "entity": input.entity,
            "mode": existing.get("name").and_then(|v| v.as_str()).unwrap_or(""),
            "appliedConfigs": display_configs,
        });

        Ok(DisplayModeRenderInModeOutput::Ok {
            output: serde_json::to_string(&output)?,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_define_mode() {
        let storage = InMemoryStorage::new();
        let handler = DisplayModeHandlerImpl;
        let result = handler.define_mode(
            DisplayModeDefineModeInput {
                mode: "full".to_string(),
                name: "Full Display".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            DisplayModeDefineModeOutput::Ok { mode } => {
                assert_eq!(mode, "full");
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_define_mode_duplicate() {
        let storage = InMemoryStorage::new();
        let handler = DisplayModeHandlerImpl;
        handler.define_mode(
            DisplayModeDefineModeInput {
                mode: "full".to_string(),
                name: "Full Display".to_string(),
            },
            &storage,
        ).await.unwrap();
        let result = handler.define_mode(
            DisplayModeDefineModeInput {
                mode: "full2".to_string(),
                name: "Full Display".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            DisplayModeDefineModeOutput::Exists { .. } => {},
            _ => panic!("Expected Exists variant"),
        }
    }

    #[tokio::test]
    async fn test_configure_field_form_not_found() {
        let storage = InMemoryStorage::new();
        let handler = DisplayModeHandlerImpl;
        let result = handler.configure_field_form(
            DisplayModeConfigureFieldFormInput {
                mode: "nonexistent".to_string(),
                field: "title".to_string(),
                config: "textfield".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            DisplayModeConfigureFieldFormOutput::Notfound { .. } => {},
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_render_in_mode_not_found() {
        let storage = InMemoryStorage::new();
        let handler = DisplayModeHandlerImpl;
        let result = handler.render_in_mode(
            DisplayModeRenderInModeInput {
                mode: "nonexistent".to_string(),
                entity: "article-1".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            DisplayModeRenderInModeOutput::Notfound { .. } => {},
            _ => panic!("Expected Notfound variant"),
        }
    }
}
