// generated: transform/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait TransformHandler: Send + Sync {
    async fn apply(
        &self,
        input: TransformApplyInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TransformApplyOutput, Box<dyn std::error::Error>>;

    async fn chain(
        &self,
        input: TransformChainInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TransformChainOutput, Box<dyn std::error::Error>>;

    async fn preview(
        &self,
        input: TransformPreviewInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TransformPreviewOutput, Box<dyn std::error::Error>>;

}
