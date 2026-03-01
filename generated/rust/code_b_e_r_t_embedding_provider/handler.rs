// generated: code_b_e_r_t_embedding_provider/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait CodeBERTEmbeddingProviderHandler: Send + Sync {
    async fn initialize(
        &self,
        input: CodeBERTEmbeddingProviderInitializeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<CodeBERTEmbeddingProviderInitializeOutput, Box<dyn std::error::Error>>;

}
