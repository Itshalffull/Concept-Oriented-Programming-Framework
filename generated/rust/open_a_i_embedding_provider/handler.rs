// generated: open_a_i_embedding_provider/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait OpenAIEmbeddingProviderHandler: Send + Sync {
    async fn initialize(
        &self,
        input: OpenAIEmbeddingProviderInitializeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<OpenAIEmbeddingProviderInitializeOutput, Box<dyn std::error::Error>>;

}
