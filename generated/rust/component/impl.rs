// Component -- discoverable, configurable UI units with conditional placement rules
// Manages registration, rendering, region placement, and visibility evaluation.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::ComponentHandler;
use serde_json::json;

pub struct ComponentHandlerImpl;

#[async_trait]
impl ComponentHandler for ComponentHandlerImpl {
    async fn register(
        &self,
        input: ComponentRegisterInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ComponentRegisterOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("component", &input.component).await?;
        if existing.is_some() {
            return Ok(ComponentRegisterOutput::Exists {
                message: "A component with this identity already exists".to_string(),
            });
        }

        storage.put("component", &input.component, json!({
            "component": input.component,
            "config": input.config,
            "placements": "[]",
            "conditions": "",
            "visible": true,
        })).await?;

        Ok(ComponentRegisterOutput::Ok)
    }

    async fn render(
        &self,
        input: ComponentRenderInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ComponentRenderOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("component", &input.component).await?;
        let record = match existing {
            Some(r) => r,
            None => {
                return Ok(ComponentRenderOutput::Notfound {
                    message: "The component was not found".to_string(),
                });
            }
        };

        let visible = record["visible"].as_bool().unwrap_or(true);
        if !visible {
            return Ok(ComponentRenderOutput::Ok {
                output: String::new(),
            });
        }

        let config = record["config"].as_str().unwrap_or("");
        let placements_str = record["placements"].as_str().unwrap_or("[]");
        let placements: Vec<String> = serde_json::from_str(placements_str).unwrap_or_default();

        let region = placements.first().map(|s| s.as_str()).unwrap_or("default");
        let output = format!("{}:{}:{}", config, region, input.context);

        Ok(ComponentRenderOutput::Ok { output })
    }

    async fn place(
        &self,
        input: ComponentPlaceInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ComponentPlaceOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("component", &input.component).await?;
        let record = match existing {
            Some(r) => r,
            None => {
                return Ok(ComponentPlaceOutput::Notfound {
                    message: "The component was not found".to_string(),
                });
            }
        };

        let placements_str = record["placements"].as_str().unwrap_or("[]");
        let mut placements: Vec<String> = serde_json::from_str(placements_str).unwrap_or_default();

        if !placements.contains(&input.region) {
            placements.push(input.region);
        }

        let mut updated = record.clone();
        updated["placements"] = json!(serde_json::to_string(&placements)?);
        storage.put("component", &input.component, updated).await?;

        Ok(ComponentPlaceOutput::Ok)
    }

    async fn set_visibility(
        &self,
        input: ComponentSetVisibilityInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ComponentSetVisibilityOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("component", &input.component).await?;
        let record = match existing {
            Some(r) => r,
            None => {
                return Ok(ComponentSetVisibilityOutput::Notfound {
                    message: "The component was not found".to_string(),
                });
            }
        };

        let mut updated = record.clone();
        updated["visible"] = json!(input.visible);
        storage.put("component", &input.component, updated).await?;

        Ok(ComponentSetVisibilityOutput::Ok)
    }

    async fn evaluate_visibility(
        &self,
        input: ComponentEvaluateVisibilityInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ComponentEvaluateVisibilityOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("component", &input.component).await?;
        let record = match existing {
            Some(r) => r,
            None => {
                return Ok(ComponentEvaluateVisibilityOutput::Notfound {
                    message: "The component was not found".to_string(),
                });
            }
        };

        let visible = record["visible"].as_bool().unwrap_or(true);
        let conditions = record["conditions"].as_str().unwrap_or("");

        // Evaluate visibility: if no conditions set, use stored flag;
        // otherwise check if context contains the condition string
        let effective_visibility = if conditions.is_empty() {
            visible
        } else {
            input.context.contains(conditions)
        };

        Ok(ComponentEvaluateVisibilityOutput::Ok {
            visible: effective_visibility,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_register_success() {
        let storage = InMemoryStorage::new();
        let handler = ComponentHandlerImpl;
        let result = handler.register(
            ComponentRegisterInput {
                component: "header".to_string(),
                config: "{}".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ComponentRegisterOutput::Ok => {},
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_register_exists() {
        let storage = InMemoryStorage::new();
        let handler = ComponentHandlerImpl;

        handler.register(
            ComponentRegisterInput { component: "header".to_string(), config: "{}".to_string() },
            &storage,
        ).await.unwrap();

        let result = handler.register(
            ComponentRegisterInput { component: "header".to_string(), config: "{}".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            ComponentRegisterOutput::Exists { .. } => {},
            _ => panic!("Expected Exists variant"),
        }
    }

    #[tokio::test]
    async fn test_render_not_found() {
        let storage = InMemoryStorage::new();
        let handler = ComponentHandlerImpl;
        let result = handler.render(
            ComponentRenderInput { component: "nonexistent".to_string(), context: "{}".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            ComponentRenderOutput::Notfound { .. } => {},
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_place_not_found() {
        let storage = InMemoryStorage::new();
        let handler = ComponentHandlerImpl;
        let result = handler.place(
            ComponentPlaceInput { component: "nonexistent".to_string(), region: "sidebar".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            ComponentPlaceOutput::Notfound { .. } => {},
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_set_visibility_not_found() {
        let storage = InMemoryStorage::new();
        let handler = ComponentHandlerImpl;
        let result = handler.set_visibility(
            ComponentSetVisibilityInput { component: "nonexistent".to_string(), visible: false },
            &storage,
        ).await.unwrap();
        match result {
            ComponentSetVisibilityOutput::Notfound { .. } => {},
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_evaluate_visibility() {
        let storage = InMemoryStorage::new();
        let handler = ComponentHandlerImpl;

        handler.register(
            ComponentRegisterInput { component: "widget".to_string(), config: "{}".to_string() },
            &storage,
        ).await.unwrap();

        let result = handler.evaluate_visibility(
            ComponentEvaluateVisibilityInput { component: "widget".to_string(), context: "admin".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            ComponentEvaluateVisibilityOutput::Ok { visible } => {
                assert!(visible);
            },
            _ => panic!("Expected Ok variant"),
        }
    }
}
