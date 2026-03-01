// OpenAIEmbeddingProvider -- initializes an OpenAI text embedding provider instance.
// Configures API endpoint, model selection, and embedding dimensions for
// semantic search and similarity operations.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::OpenAIEmbeddingProviderHandler;
use serde_json::json;

pub struct OpenAIEmbeddingProviderHandlerImpl;

#[async_trait]
impl OpenAIEmbeddingProviderHandler for OpenAIEmbeddingProviderHandlerImpl {
    async fn initialize(
        &self,
        _input: OpenAIEmbeddingProviderInitializeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<OpenAIEmbeddingProviderInitializeOutput, Box<dyn std::error::Error>> {
        // Check if OPENAI_API_KEY is configured in the environment or storage
        let config = storage.get("config", "openai").await?;

        let api_key_present = config.as_ref()
            .and_then(|c| c.get("apiKey").and_then(|v| v.as_str()))
            .map(|k| !k.is_empty())
            .unwrap_or(false);

        if !api_key_present {
            // Check environment as fallback
            let env_key = std::env::var("OPENAI_API_KEY").unwrap_or_default();
            if env_key.is_empty() {
                return Ok(OpenAIEmbeddingProviderInitializeOutput::LoadError {
                    message: "OpenAI API key not configured. Set OPENAI_API_KEY or store via config/openai.".to_string(),
                });
            }
        }

        let model = config.as_ref()
            .and_then(|c| c.get("model").and_then(|v| v.as_str()))
            .unwrap_or("text-embedding-3-small");

        let dimensions: u32 = config.as_ref()
            .and_then(|c| c.get("dimensions").and_then(|v| v.as_u64()))
            .unwrap_or(1536) as u32;

        let instance_id = format!("openai-embed-{}", chrono::Utc::now().timestamp_millis());

        let instance = json!({
            "instanceId": instance_id,
            "provider": "openai",
            "model": model,
            "dimensions": dimensions,
            "status": "initialized",
        });

        storage.put("embedding-provider", &instance_id, instance.clone()).await?;

        Ok(OpenAIEmbeddingProviderInitializeOutput::Ok {
            instance: serde_json::to_string(&instance)?,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_initialize_with_storage_api_key() {
        let storage = InMemoryStorage::new();
        storage.put("config", "openai", json!({
            "apiKey": "sk-test-key-12345",
            "model": "text-embedding-3-large",
            "dimensions": 3072,
        })).await.unwrap();
        let handler = OpenAIEmbeddingProviderHandlerImpl;
        let result = handler.initialize(
            OpenAIEmbeddingProviderInitializeInput {},
            &storage,
        ).await.unwrap();
        match result {
            OpenAIEmbeddingProviderInitializeOutput::Ok { instance } => {
                assert!(instance.contains("openai"));
                assert!(instance.contains("text-embedding-3-large"));
                assert!(instance.contains("3072"));
            }
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_initialize_no_api_key() {
        let storage = InMemoryStorage::new();
        // Ensure env var is not set for this test
        std::env::remove_var("OPENAI_API_KEY");
        let handler = OpenAIEmbeddingProviderHandlerImpl;
        let result = handler.initialize(
            OpenAIEmbeddingProviderInitializeInput {},
            &storage,
        ).await.unwrap();
        match result {
            OpenAIEmbeddingProviderInitializeOutput::LoadError { message } => {
                assert!(message.contains("API key"));
            }
            _ => panic!("Expected LoadError variant"),
        }
    }

    #[tokio::test]
    async fn test_initialize_default_model() {
        let storage = InMemoryStorage::new();
        storage.put("config", "openai", json!({
            "apiKey": "sk-test-key-12345",
        })).await.unwrap();
        let handler = OpenAIEmbeddingProviderHandlerImpl;
        let result = handler.initialize(
            OpenAIEmbeddingProviderInitializeInput {},
            &storage,
        ).await.unwrap();
        match result {
            OpenAIEmbeddingProviderInitializeOutput::Ok { instance } => {
                assert!(instance.contains("text-embedding-3-small"));
                assert!(instance.contains("1536"));
            }
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_initialize_with_env_api_key() {
        let storage = InMemoryStorage::new();
        std::env::set_var("OPENAI_API_KEY", "sk-env-test-key");
        let handler = OpenAIEmbeddingProviderHandlerImpl;
        let result = handler.initialize(
            OpenAIEmbeddingProviderInitializeInput {},
            &storage,
        ).await.unwrap();
        std::env::remove_var("OPENAI_API_KEY");
        match result {
            OpenAIEmbeddingProviderInitializeOutput::Ok { instance } => {
                assert!(instance.contains("openai-embed-"));
                assert!(instance.contains("initialized"));
            },
            other => panic!("Expected Ok variant, got {:?}", other),
        }
    }

    #[tokio::test]
    async fn test_initialize_empty_stored_api_key_no_env() {
        let storage = InMemoryStorage::new();
        std::env::remove_var("OPENAI_API_KEY");
        storage.put("config", "openai", json!({
            "apiKey": "",
        })).await.unwrap();
        let handler = OpenAIEmbeddingProviderHandlerImpl;
        let result = handler.initialize(
            OpenAIEmbeddingProviderInitializeInput {},
            &storage,
        ).await.unwrap();
        match result {
            OpenAIEmbeddingProviderInitializeOutput::LoadError { message } => {
                assert!(message.contains("API key"));
            },
            other => panic!("Expected LoadError variant, got {:?}", other),
        }
    }
}
