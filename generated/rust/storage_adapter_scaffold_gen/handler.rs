// generated: storage_adapter_scaffold_gen/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait StorageAdapterScaffoldGenHandler: Send + Sync {
    async fn generate(
        &self,
        input: StorageAdapterScaffoldGenGenerateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<StorageAdapterScaffoldGenGenerateOutput, Box<dyn std::error::Error>>;

    async fn preview(
        &self,
        input: StorageAdapterScaffoldGenPreviewInput,
        storage: &dyn ConceptStorage,
    ) -> Result<StorageAdapterScaffoldGenPreviewOutput, Box<dyn std::error::Error>>;

    async fn register(
        &self,
        input: StorageAdapterScaffoldGenRegisterInput,
        storage: &dyn ConceptStorage,
    ) -> Result<StorageAdapterScaffoldGenRegisterOutput, Box<dyn std::error::Error>>;

}
