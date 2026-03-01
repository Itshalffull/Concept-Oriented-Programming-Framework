// CodeBERT Embedding Provider -- initialize a CodeBERT-based code embedding model
// Provides vector embeddings for source code using the CodeBERT transformer architecture.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::CodeBERTEmbeddingProviderHandler;
use serde_json::json;

pub struct CodeBERTEmbeddingProviderHandlerImpl;

#[async_trait]
impl CodeBERTEmbeddingProviderHandler for CodeBERTEmbeddingProviderHandlerImpl {
    async fn initialize(
        &self,
        _input: CodeBERTEmbeddingProviderInitializeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<CodeBERTEmbeddingProviderInitializeOutput, Box<dyn std::error::Error>> {
        // Check if an instance is already loaded
        let existing = storage.get("embedding_provider", "codebert").await?;
        if let Some(record) = existing {
            if record.get("status").and_then(|v| v.as_str()) == Some("ready") {
                return Ok(CodeBERTEmbeddingProviderInitializeOutput::Ok {
                    instance: record["instance"].as_str().unwrap_or("codebert-0").to_string(),
                });
            }
        }

        // Initialize the CodeBERT embedding provider
        // In a real implementation, this would load the model weights
        let instance_id = "codebert-base-v1";

        storage.put("embedding_provider", "codebert", json!({
            "instance": instance_id,
            "model": "microsoft/codebert-base",
            "dimensions": 768,
            "maxSequenceLength": 512,
            "status": "ready",
        })).await?;

        Ok(CodeBERTEmbeddingProviderInitializeOutput::Ok {
            instance: instance_id.to_string(),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_initialize_success() {
        let storage = InMemoryStorage::new();
        let handler = CodeBERTEmbeddingProviderHandlerImpl;
        let result = handler.initialize(
            CodeBERTEmbeddingProviderInitializeInput {},
            &storage,
        ).await.unwrap();
        match result {
            CodeBERTEmbeddingProviderInitializeOutput::Ok { instance } => {
                assert_eq!(instance, "codebert-base-v1");
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_initialize_idempotent() {
        let storage = InMemoryStorage::new();
        let handler = CodeBERTEmbeddingProviderHandlerImpl;

        // Initialize twice
        handler.initialize(CodeBERTEmbeddingProviderInitializeInput {}, &storage).await.unwrap();
        let result = handler.initialize(CodeBERTEmbeddingProviderInitializeInput {}, &storage).await.unwrap();

        match result {
            CodeBERTEmbeddingProviderInitializeOutput::Ok { instance } => {
                assert_eq!(instance, "codebert-base-v1");
            },
            _ => panic!("Expected Ok variant on second call"),
        }
    }
}
