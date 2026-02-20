// generated: comment/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait CommentHandler: Send + Sync {
    async fn create(
        &self,
        input: CommentCreateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<CommentCreateOutput, Box<dyn std::error::Error>>;

    async fn delete(
        &self,
        input: CommentDeleteInput,
        storage: &dyn ConceptStorage,
    ) -> Result<CommentDeleteOutput, Box<dyn std::error::Error>>;

    async fn list(
        &self,
        input: CommentListInput,
        storage: &dyn ConceptStorage,
    ) -> Result<CommentListOutput, Box<dyn std::error::Error>>;

}
