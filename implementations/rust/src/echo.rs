// Echo Concept Implementation (Rust)
//
// Mirrors the TypeScript echo.impl.ts — send action.
// Stores text and returns it as echo.

use crate::storage::{ConceptStorage, StorageResult};
use serde::{Deserialize, Serialize};
use serde_json::json;

// ── Types ──────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct EchoSendInput {
    pub id: String,
    pub text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum EchoSendOutput {
    #[serde(rename = "ok")]
    Ok { id: String, echo: String },
}

// ── Handler ────────────────────────────────────────────────

pub struct EchoHandler;

impl EchoHandler {
    pub async fn send(
        &self,
        input: EchoSendInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<EchoSendOutput> {
        storage
            .put("echo", &input.id, json!({ "text": input.text }))
            .await?;

        Ok(EchoSendOutput::Ok {
            id: input.id,
            echo: input.text,
        })
    }
}

// ── Tests ──────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn send_echo() {
        let storage = InMemoryStorage::new();
        let handler = EchoHandler;

        let result = handler
            .send(
                EchoSendInput {
                    id: "e1".into(),
                    text: "Hello, world!".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        match result {
            EchoSendOutput::Ok { id, echo } => {
                assert_eq!(id, "e1");
                assert_eq!(echo, "Hello, world!");
            }
        }
    }

    #[tokio::test]
    async fn send_stores_in_storage() {
        let storage = InMemoryStorage::new();
        let handler = EchoHandler;

        handler
            .send(
                EchoSendInput {
                    id: "e1".into(),
                    text: "Stored text".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        let record = storage.get("echo", "e1").await.unwrap();
        assert!(record.is_some());
        let record = record.unwrap();
        assert_eq!(record["text"].as_str().unwrap(), "Stored text");
    }

    #[tokio::test]
    async fn send_different_messages() {
        let storage = InMemoryStorage::new();
        let handler = EchoHandler;

        let r1 = handler
            .send(
                EchoSendInput {
                    id: "e1".into(),
                    text: "First".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        let r2 = handler
            .send(
                EchoSendInput {
                    id: "e2".into(),
                    text: "Second".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        assert!(matches!(r1, EchoSendOutput::Ok { ref echo, .. } if echo == "First"));
        assert!(matches!(r2, EchoSendOutput::Ok { ref echo, .. } if echo == "Second"));
    }
}
