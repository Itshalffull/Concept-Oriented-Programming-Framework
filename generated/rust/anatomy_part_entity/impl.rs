// AnatomyPartEntity concept implementation
// Named part within a widget's anatomy -- each carries a semantic role
// and connects to props via the connect section.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::AnatomyPartEntityHandler;
use serde_json::json;
use std::sync::atomic::{AtomicU64, Ordering};

static ID_COUNTER: AtomicU64 = AtomicU64::new(0);

fn next_id() -> String {
    let id = ID_COUNTER.fetch_add(1, Ordering::SeqCst) + 1;
    format!("anatomy-part-entity-{}", id)
}

pub struct AnatomyPartEntityHandlerImpl;

#[async_trait]
impl AnatomyPartEntityHandler for AnatomyPartEntityHandlerImpl {
    async fn register(
        &self,
        input: AnatomyPartEntityRegisterInput,
        storage: &dyn ConceptStorage,
    ) -> Result<AnatomyPartEntityRegisterOutput, Box<dyn std::error::Error>> {
        let id = next_id();
        let symbol = format!("clef/anatomy/{}/{}", input.widget, input.name);

        storage.put("anatomy-part-entity", &id, json!({
            "id": id,
            "widget": input.widget,
            "name": input.name,
            "symbol": symbol,
            "semanticRole": input.role,
            "required": input.required,
            "description": "",
            "connectProps": "[]",
            "ariaAttrs": "[]",
            "boundField": "",
            "boundAction": "",
        })).await?;

        Ok(AnatomyPartEntityRegisterOutput::Ok { part: id })
    }

    async fn find_by_role(
        &self,
        input: AnatomyPartEntityFindByRoleInput,
        storage: &dyn ConceptStorage,
    ) -> Result<AnatomyPartEntityFindByRoleOutput, Box<dyn std::error::Error>> {
        let results = storage.find("anatomy-part-entity", Some(&json!({
            "semanticRole": input.role,
        }))).await?;

        Ok(AnatomyPartEntityFindByRoleOutput::Ok {
            parts: serde_json::to_string(&results)?,
        })
    }

    async fn find_bound_to_field(
        &self,
        input: AnatomyPartEntityFindBoundToFieldInput,
        storage: &dyn ConceptStorage,
    ) -> Result<AnatomyPartEntityFindBoundToFieldOutput, Box<dyn std::error::Error>> {
        let results = storage.find("anatomy-part-entity", Some(&json!({
            "boundField": input.field,
        }))).await?;

        Ok(AnatomyPartEntityFindBoundToFieldOutput::Ok {
            parts: serde_json::to_string(&results)?,
        })
    }

    async fn find_bound_to_action(
        &self,
        input: AnatomyPartEntityFindBoundToActionInput,
        storage: &dyn ConceptStorage,
    ) -> Result<AnatomyPartEntityFindBoundToActionOutput, Box<dyn std::error::Error>> {
        let results = storage.find("anatomy-part-entity", Some(&json!({
            "boundAction": input.action,
        }))).await?;

        Ok(AnatomyPartEntityFindBoundToActionOutput::Ok {
            parts: serde_json::to_string(&results)?,
        })
    }

    async fn get(
        &self,
        input: AnatomyPartEntityGetInput,
        storage: &dyn ConceptStorage,
    ) -> Result<AnatomyPartEntityGetOutput, Box<dyn std::error::Error>> {
        let record = storage.get("anatomy-part-entity", &input.part).await?;
        match record {
            Some(r) => Ok(AnatomyPartEntityGetOutput::Ok {
                part: r["id"].as_str().unwrap_or("").to_string(),
                widget: r["widget"].as_str().unwrap_or("").to_string(),
                name: r["name"].as_str().unwrap_or("").to_string(),
                semantic_role: r["semanticRole"].as_str().unwrap_or("").to_string(),
                required: r["required"].as_str().unwrap_or("").to_string(),
            }),
            None => Ok(AnatomyPartEntityGetOutput::Notfound),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_register_creates_part() {
        let storage = InMemoryStorage::new();
        let handler = AnatomyPartEntityHandlerImpl;
        let result = handler.register(
            AnatomyPartEntityRegisterInput {
                widget: "Button".to_string(),
                name: "label".to_string(),
                role: "content".to_string(),
                required: "true".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            AnatomyPartEntityRegisterOutput::Ok { part } => {
                assert!(!part.is_empty());
            }
        }
    }

    #[tokio::test]
    async fn test_get_existing_part() {
        let storage = InMemoryStorage::new();
        let handler = AnatomyPartEntityHandlerImpl;
        let reg = handler.register(
            AnatomyPartEntityRegisterInput {
                widget: "Card".to_string(),
                name: "header".to_string(),
                role: "structure".to_string(),
                required: "false".to_string(),
            },
            &storage,
        ).await.unwrap();
        let part_id = match reg {
            AnatomyPartEntityRegisterOutput::Ok { part } => part,
        };
        let result = handler.get(
            AnatomyPartEntityGetInput { part: part_id },
            &storage,
        ).await.unwrap();
        match result {
            AnatomyPartEntityGetOutput::Ok { widget, name, semantic_role, .. } => {
                assert_eq!(widget, "Card");
                assert_eq!(name, "header");
                assert_eq!(semantic_role, "structure");
            }
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_get_nonexistent_part_returns_notfound() {
        let storage = InMemoryStorage::new();
        let handler = AnatomyPartEntityHandlerImpl;
        let result = handler.get(
            AnatomyPartEntityGetInput { part: "nonexistent".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            AnatomyPartEntityGetOutput::Notfound => {}
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_find_by_role() {
        let storage = InMemoryStorage::new();
        let handler = AnatomyPartEntityHandlerImpl;
        handler.register(
            AnatomyPartEntityRegisterInput {
                widget: "Modal".to_string(),
                name: "overlay".to_string(),
                role: "interaction".to_string(),
                required: "true".to_string(),
            },
            &storage,
        ).await.unwrap();
        let result = handler.find_by_role(
            AnatomyPartEntityFindByRoleInput { role: "interaction".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            AnatomyPartEntityFindByRoleOutput::Ok { parts } => {
                assert!(!parts.is_empty());
            }
        }
    }
}
