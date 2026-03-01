// Echo Handler Implementation
//
// Simple echo concept: stores a text message and returns it unchanged.
// Used for testing transport and handler infrastructure.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::EchoHandler;
use serde_json::json;

pub struct EchoHandlerImpl;

#[async_trait]
impl EchoHandler for EchoHandlerImpl {
    async fn send(
        &self,
        input: EchoSendInput,
        storage: &dyn ConceptStorage,
    ) -> Result<EchoSendOutput, Box<dyn std::error::Error>> {
        storage.put("echo", &input.id, json!({ "text": input.text })).await?;

        Ok(EchoSendOutput::Ok {
            id: input.id,
            echo: input.text,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_send() {
        let storage = InMemoryStorage::new();
        let handler = EchoHandlerImpl;
        let result = handler.send(
            EchoSendInput {
                id: "echo-1".to_string(),
                text: "hello world".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            EchoSendOutput::Ok { id, echo } => {
                assert_eq!(id, "echo-1");
                assert_eq!(echo, "hello world");
            },
        }
    }

    #[tokio::test]
    async fn test_send_stores_in_storage() {
        let storage = InMemoryStorage::new();
        let handler = EchoHandlerImpl;
        handler.send(
            EchoSendInput {
                id: "echo-2".to_string(),
                text: "stored text".to_string(),
            },
            &storage,
        ).await.unwrap();
        let record = storage.get("echo", "echo-2").await.unwrap();
        assert!(record.is_some());
        assert_eq!(record.unwrap()["text"], "stored text");
    }
}
