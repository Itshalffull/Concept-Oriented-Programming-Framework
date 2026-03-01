// Slot concept implementation
// Named insertion points within host components for composable content projection.
// Slots can be defined within a host, filled with content, and cleared.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::SlotHandler;
use serde_json::json;

pub struct SlotHandlerImpl;

fn generate_slot_id() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let t = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default();
    format!("slot-{}-{}", t.as_secs(), t.subsec_nanos())
}

#[async_trait]
impl SlotHandler for SlotHandlerImpl {
    async fn define(
        &self,
        input: SlotDefineInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SlotDefineOutput, Box<dyn std::error::Error>> {
        let slot_id = &input.slot;

        let existing = storage.get("slot", slot_id).await?;
        if existing.is_some() {
            return Ok(SlotDefineOutput::Duplicate {
                message: "A slot with this identity already exists".to_string(),
            });
        }

        let name = if input.name.is_empty() {
            generate_slot_id()
        } else {
            input.name.clone()
        };

        storage.put("slot", slot_id, json!({
            "slot": slot_id,
            "name": name,
            "host": &input.host,
            "content": "",
            "position": if input.position.is_empty() { "default" } else { &input.position },
            "fallback": input.fallback.as_deref().unwrap_or(""),
        })).await?;

        Ok(SlotDefineOutput::Ok {
            slot: slot_id.clone(),
        })
    }

    async fn fill(
        &self,
        input: SlotFillInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SlotFillOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("slot", &input.slot).await?;
        let existing = match existing {
            Some(e) => e,
            None => {
                return Ok(SlotFillOutput::Notfound {
                    message: "Slot not found".to_string(),
                });
            }
        };

        let mut updated = existing.clone();
        if let Some(obj) = updated.as_object_mut() {
            obj.insert("content".to_string(), json!(&input.content));
        }

        storage.put("slot", &input.slot, updated).await?;

        Ok(SlotFillOutput::Ok {
            slot: input.slot.clone(),
        })
    }

    async fn clear(
        &self,
        input: SlotClearInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SlotClearOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("slot", &input.slot).await?;
        let existing = match existing {
            Some(e) => e,
            None => {
                return Ok(SlotClearOutput::Notfound {
                    message: "Slot not found".to_string(),
                });
            }
        };

        let mut updated = existing.clone();
        if let Some(obj) = updated.as_object_mut() {
            obj.insert("content".to_string(), json!(""));
        }

        storage.put("slot", &input.slot, updated).await?;

        Ok(SlotClearOutput::Ok {
            slot: input.slot.clone(),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_define_success() {
        let storage = InMemoryStorage::new();
        let handler = SlotHandlerImpl;
        let result = handler.define(
            SlotDefineInput {
                slot: "slot-1".to_string(),
                name: "header-slot".to_string(),
                host: "app-shell".to_string(),
                position: "top".to_string(),
                fallback: None,
            },
            &storage,
        ).await.unwrap();
        match result {
            SlotDefineOutput::Ok { slot } => {
                assert_eq!(slot, "slot-1");
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_define_duplicate() {
        let storage = InMemoryStorage::new();
        let handler = SlotHandlerImpl;
        handler.define(
            SlotDefineInput {
                slot: "slot-1".to_string(), name: "s".to_string(), host: "h".to_string(),
                position: "".to_string(), fallback: None,
            },
            &storage,
        ).await.unwrap();
        let result = handler.define(
            SlotDefineInput {
                slot: "slot-1".to_string(), name: "s2".to_string(), host: "h".to_string(),
                position: "".to_string(), fallback: None,
            },
            &storage,
        ).await.unwrap();
        match result {
            SlotDefineOutput::Duplicate { .. } => {},
            _ => panic!("Expected Duplicate variant"),
        }
    }

    #[tokio::test]
    async fn test_fill_not_found() {
        let storage = InMemoryStorage::new();
        let handler = SlotHandlerImpl;
        let result = handler.fill(
            SlotFillInput { slot: "missing".to_string(), content: "stuff".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            SlotFillOutput::Notfound { .. } => {},
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_clear_not_found() {
        let storage = InMemoryStorage::new();
        let handler = SlotHandlerImpl;
        let result = handler.clear(
            SlotClearInput { slot: "missing".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            SlotClearOutput::Notfound { .. } => {},
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_fill_ok() {
        let storage = InMemoryStorage::new();
        let handler = SlotHandlerImpl;
        handler.define(
            SlotDefineInput {
                slot: "fill-slot".to_string(),
                name: "Main".to_string(),
                host: "page".to_string(),
                position: "center".to_string(),
                fallback: None,
            },
            &storage,
        ).await.unwrap();
        let result = handler.fill(
            SlotFillInput {
                slot: "fill-slot".to_string(),
                content: "<div>Hello</div>".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            SlotFillOutput::Ok { slot } => {
                assert_eq!(slot, "fill-slot");
            },
            other => panic!("Expected Ok variant, got {:?}", other),
        }
    }

    #[tokio::test]
    async fn test_clear_ok() {
        let storage = InMemoryStorage::new();
        let handler = SlotHandlerImpl;
        handler.define(
            SlotDefineInput {
                slot: "clear-slot".to_string(),
                name: "Sidebar".to_string(),
                host: "layout".to_string(),
                position: "left".to_string(),
                fallback: Some("Default sidebar".to_string()),
            },
            &storage,
        ).await.unwrap();
        handler.fill(
            SlotFillInput {
                slot: "clear-slot".to_string(),
                content: "<nav>Menu</nav>".to_string(),
            },
            &storage,
        ).await.unwrap();
        let result = handler.clear(
            SlotClearInput { slot: "clear-slot".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            SlotClearOutput::Ok { slot } => {
                assert_eq!(slot, "clear-slot");
            },
            other => panic!("Expected Ok variant, got {:?}", other),
        }
    }

    #[tokio::test]
    async fn test_define_with_fallback() {
        let storage = InMemoryStorage::new();
        let handler = SlotHandlerImpl;
        let result = handler.define(
            SlotDefineInput {
                slot: "fb-slot".to_string(),
                name: "Footer".to_string(),
                host: "page".to_string(),
                position: "bottom".to_string(),
                fallback: Some("Default footer content".to_string()),
            },
            &storage,
        ).await.unwrap();
        match result {
            SlotDefineOutput::Ok { slot } => {
                assert_eq!(slot, "fb-slot");
            },
            other => panic!("Expected Ok variant, got {:?}", other),
        }
    }
}
