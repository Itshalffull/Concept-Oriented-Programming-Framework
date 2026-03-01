// generated: voyage_code_embedding_provider/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait VoyageCodeEmbeddingProviderHandler: Send + Sync {
    async fn initialize(
        &self,
        input: VoyageCodeEmbeddingProviderInitializeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<VoyageCodeEmbeddingProviderInitializeOutput, Box<dyn std::error::Error>>;

}
