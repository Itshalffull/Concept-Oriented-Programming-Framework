// generated: content_storage/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait ContentStorageHandler: Send + Sync {
    async fn save(
        &self,
        input: ContentStorageSaveInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ContentStorageSaveOutput, Box<dyn std::error::Error>>;

    async fn load(
        &self,
        input: ContentStorageLoadInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ContentStorageLoadOutput, Box<dyn std::error::Error>>;

    async fn delete(
        &self,
        input: ContentStorageDeleteInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ContentStorageDeleteOutput, Box<dyn std::error::Error>>;

    async fn query(
        &self,
        input: ContentStorageQueryInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ContentStorageQueryOutput, Box<dyn std::error::Error>>;

    async fn generate_schema(
        &self,
        input: ContentStorageGenerateSchemaInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ContentStorageGenerateSchemaOutput, Box<dyn std::error::Error>>;

}
