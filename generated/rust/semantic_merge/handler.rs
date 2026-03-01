// generated: semantic_merge/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait SemanticMergeHandler: Send + Sync {
    async fn register(
        &self,
        input: SemanticMergeRegisterInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SemanticMergeRegisterOutput, Box<dyn std::error::Error>>;

    async fn execute(
        &self,
        input: SemanticMergeExecuteInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SemanticMergeExecuteOutput, Box<dyn std::error::Error>>;

}
