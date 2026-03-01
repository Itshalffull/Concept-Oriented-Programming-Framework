// generated: semantic_embedding/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait SemanticEmbeddingHandler: Send + Sync {
    async fn compute(
        &self,
        input: SemanticEmbeddingComputeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SemanticEmbeddingComputeOutput, Box<dyn std::error::Error>>;

    async fn search_similar(
        &self,
        input: SemanticEmbeddingSearchSimilarInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SemanticEmbeddingSearchSimilarOutput, Box<dyn std::error::Error>>;

    async fn search_natural_language(
        &self,
        input: SemanticEmbeddingSearchNaturalLanguageInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SemanticEmbeddingSearchNaturalLanguageOutput, Box<dyn std::error::Error>>;

    async fn get(
        &self,
        input: SemanticEmbeddingGetInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SemanticEmbeddingGetOutput, Box<dyn std::error::Error>>;

}
