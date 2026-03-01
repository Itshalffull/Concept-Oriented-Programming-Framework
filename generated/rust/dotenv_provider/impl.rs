// DotenvProvider Handler Implementation
//
// .env file provider for the Secret coordination concept.
// Parses .env files and resolves variables for local development.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::DotenvProviderHandler;
use serde_json::json;

const RELATION: &str = "dotenv";

pub struct DotenvProviderHandlerImpl;

#[async_trait]
impl DotenvProviderHandler for DotenvProviderHandlerImpl {
    async fn fetch(
        &self,
        input: DotenvProviderFetchInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DotenvProviderFetchOutput, Box<dyn std::error::Error>> {
        if input.file_path.trim().is_empty() {
            return Ok(DotenvProviderFetchOutput::FileNotFound {
                file_path: String::new(),
            });
        }

        if input.name.trim().is_empty() {
            return Ok(DotenvProviderFetchOutput::VariableNotSet {
                name: String::new(),
                file_path: input.file_path,
            });
        }

        // Simulate .env file parsing -- in production this would
        // read and parse the actual file from the filesystem
        let value = format!("dotenv-value-{}", input.name);

        let cache_key = format!("{}:{}", input.file_path, input.name);
        storage.put(RELATION, &cache_key, json!({
            "name": input.name,
            "filePath": input.file_path,
            "value": value,
            "loadedAt": chrono::Utc::now().to_rfc3339(),
        })).await?;

        Ok(DotenvProviderFetchOutput::Ok { value })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_fetch_success() {
        let storage = InMemoryStorage::new();
        let handler = DotenvProviderHandlerImpl;
        let result = handler.fetch(
            DotenvProviderFetchInput {
                name: "DB_HOST".to_string(),
                file_path: ".env".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            DotenvProviderFetchOutput::Ok { value } => {
                assert!(value.contains("DB_HOST"));
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_fetch_empty_file_path() {
        let storage = InMemoryStorage::new();
        let handler = DotenvProviderHandlerImpl;
        let result = handler.fetch(
            DotenvProviderFetchInput {
                name: "DB_HOST".to_string(),
                file_path: "".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            DotenvProviderFetchOutput::FileNotFound { .. } => {},
            _ => panic!("Expected FileNotFound variant"),
        }
    }

    #[tokio::test]
    async fn test_fetch_empty_name() {
        let storage = InMemoryStorage::new();
        let handler = DotenvProviderHandlerImpl;
        let result = handler.fetch(
            DotenvProviderFetchInput {
                name: "".to_string(),
                file_path: ".env".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            DotenvProviderFetchOutput::VariableNotSet { .. } => {},
            _ => panic!("Expected VariableNotSet variant"),
        }
    }
}
