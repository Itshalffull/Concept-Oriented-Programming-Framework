// Control Handler Implementation
//
// Bind interactive elements (buttons, sliders, toggles) to data values
// and actions, enabling direct manipulation in content.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::ControlHandler;
use serde_json::json;

pub struct ControlHandlerImpl;

#[async_trait]
impl ControlHandler for ControlHandlerImpl {
    async fn create(
        &self,
        input: ControlCreateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ControlCreateOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("control", &input.control).await?;
        if existing.is_some() {
            return Ok(ControlCreateOutput::Exists {
                message: "A control with this identity already exists".to_string(),
            });
        }

        storage.put("control", &input.control, json!({
            "control": input.control,
            "type": input.r#type,
            "value": "",
            "binding": input.binding,
            "action": "",
        })).await?;

        Ok(ControlCreateOutput::Ok)
    }

    async fn interact(
        &self,
        input: ControlInteractInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ControlInteractOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("control", &input.control).await?;
        match existing {
            None => Ok(ControlInteractOutput::Notfound {
                message: "The control was not found".to_string(),
            }),
            Some(mut rec) => {
                let control_type = rec["type"].as_str().unwrap_or("").to_string();
                let binding = rec["binding"].as_str().unwrap_or("").to_string();

                // Process the interaction: update value based on input
                rec["value"] = json!(input.input);
                storage.put("control", &input.control, rec).await?;

                let result = format!("{}:{}:{}", control_type, binding, input.input);
                Ok(ControlInteractOutput::Ok { result })
            }
        }
    }

    async fn get_value(
        &self,
        input: ControlGetValueInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ControlGetValueOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("control", &input.control).await?;
        match existing {
            None => Ok(ControlGetValueOutput::Notfound {
                message: "The control was not found".to_string(),
            }),
            Some(rec) => {
                let value = rec["value"].as_str().unwrap_or("").to_string();
                Ok(ControlGetValueOutput::Ok { value })
            }
        }
    }

    async fn set_value(
        &self,
        input: ControlSetValueInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ControlSetValueOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("control", &input.control).await?;
        match existing {
            None => Ok(ControlSetValueOutput::Notfound {
                message: "The control was not found".to_string(),
            }),
            Some(mut rec) => {
                rec["value"] = json!(input.value);
                storage.put("control", &input.control, rec).await?;
                Ok(ControlSetValueOutput::Ok)
            }
        }
    }

    async fn trigger_action(
        &self,
        input: ControlTriggerActionInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ControlTriggerActionOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("control", &input.control).await?;
        match existing {
            None => Ok(ControlTriggerActionOutput::Notfound {
                message: "The control was not found".to_string(),
            }),
            Some(rec) => {
                let control_type = rec["type"].as_str().unwrap_or("").to_string();
                let binding = rec["binding"].as_str().unwrap_or("").to_string();
                let action = rec["action"].as_str().unwrap_or("").to_string();
                let value = rec["value"].as_str().unwrap_or("").to_string();

                let result = format!("{}:{}:{}:{}", control_type, binding, action, value);
                Ok(ControlTriggerActionOutput::Ok { result })
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_create_success() {
        let storage = InMemoryStorage::new();
        let handler = ControlHandlerImpl;
        let result = handler.create(
            ControlCreateInput {
                control: "btn-1".to_string(),
                r#type: "button".to_string(),
                binding: "submit-form".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ControlCreateOutput::Ok => {},
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_create_exists() {
        let storage = InMemoryStorage::new();
        let handler = ControlHandlerImpl;

        handler.create(
            ControlCreateInput { control: "btn-1".to_string(), r#type: "button".to_string(), binding: "b".to_string() },
            &storage,
        ).await.unwrap();

        let result = handler.create(
            ControlCreateInput { control: "btn-1".to_string(), r#type: "button".to_string(), binding: "b".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            ControlCreateOutput::Exists { .. } => {},
            _ => panic!("Expected Exists variant"),
        }
    }

    #[tokio::test]
    async fn test_interact_not_found() {
        let storage = InMemoryStorage::new();
        let handler = ControlHandlerImpl;
        let result = handler.interact(
            ControlInteractInput { control: "nonexistent".to_string(), input: "click".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            ControlInteractOutput::Notfound { .. } => {},
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_get_value_not_found() {
        let storage = InMemoryStorage::new();
        let handler = ControlHandlerImpl;
        let result = handler.get_value(
            ControlGetValueInput { control: "nonexistent".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            ControlGetValueOutput::Notfound { .. } => {},
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_set_value_not_found() {
        let storage = InMemoryStorage::new();
        let handler = ControlHandlerImpl;
        let result = handler.set_value(
            ControlSetValueInput { control: "nonexistent".to_string(), value: "42".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            ControlSetValueOutput::Notfound { .. } => {},
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_trigger_action_not_found() {
        let storage = InMemoryStorage::new();
        let handler = ControlHandlerImpl;
        let result = handler.trigger_action(
            ControlTriggerActionInput { control: "nonexistent".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            ControlTriggerActionOutput::Notfound { .. } => {},
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_interact_success() {
        let storage = InMemoryStorage::new();
        let handler = ControlHandlerImpl;

        handler.create(
            ControlCreateInput { control: "slider-1".to_string(), r#type: "slider".to_string(), binding: "volume".to_string() },
            &storage,
        ).await.unwrap();

        let result = handler.interact(
            ControlInteractInput { control: "slider-1".to_string(), input: "75".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            ControlInteractOutput::Ok { result } => {
                assert!(result.contains("slider"));
                assert!(result.contains("volume"));
            },
            _ => panic!("Expected Ok variant"),
        }
    }
}
