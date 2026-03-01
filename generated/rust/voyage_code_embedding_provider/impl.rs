// VoyageCodeEmbeddingProvider handler implementation
// Embedding model provider using Voyage AI's voyage-code model.
// Code-optimised embeddings for code search tasks.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::VoyageCodeEmbeddingProviderHandler;
use serde_json::json;
use std::sync::atomic::{AtomicU64, Ordering};

static ID_COUNTER: AtomicU64 = AtomicU64::new(0);

fn next_id() -> String {
    let id = ID_COUNTER.fetch_add(1, Ordering::SeqCst) + 1;
    format!("voyage-code-embedding-provider-{}", id)
}

const MODEL_NAME: &str = "voyage-code";
const PROVIDER_REF: &str = "embedding:voyage-code";

pub struct VoyageCodeEmbeddingProviderHandlerImpl;

#[async_trait]
impl VoyageCodeEmbeddingProviderHandler for VoyageCodeEmbeddingProviderHandlerImpl {
    async fn initialize(
        &self,
        _input: VoyageCodeEmbeddingProviderInitializeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<VoyageCodeEmbeddingProviderInitializeOutput, Box<dyn std::error::Error>> {
        // Check if already initialised
        let existing = storage.find("voyage-code-embedding-provider", Some(&json!({"providerRef": PROVIDER_REF}))).await?;
        if !existing.is_empty() {
            if let Some(id) = existing[0].get("id").and_then(|v| v.as_str()) {
                return Ok(VoyageCodeEmbeddingProviderInitializeOutput::Ok {
                    instance: id.to_string(),
                });
            }
        }

        let id = next_id();
        storage.put("voyage-code-embedding-provider", &id, json!({
            "id": id,
            "providerRef": PROVIDER_REF,
            "modelName": MODEL_NAME,
        })).await?;

        Ok(VoyageCodeEmbeddingProviderInitializeOutput::Ok { instance: id })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_initialize_success() {
        let storage = InMemoryStorage::new();
        let handler = VoyageCodeEmbeddingProviderHandlerImpl;
        let result = handler.initialize(
            VoyageCodeEmbeddingProviderInitializeInput {},
            &storage,
        ).await.unwrap();
        match result {
            VoyageCodeEmbeddingProviderInitializeOutput::Ok { instance } => {
                assert!(!instance.is_empty());
                assert!(instance.contains("voyage-code-embedding-provider"));
            },
            _ => panic!("Expected Ok variant"),
        }
    }
}
