// generated: comment/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait CommentHandler: Send + Sync {
    async fn add_comment(
        &self,
        input: CommentAddCommentInput,
        storage: &dyn ConceptStorage,
    ) -> Result<CommentAddCommentOutput, Box<dyn std::error::Error>>;

    async fn reply(
        &self,
        input: CommentReplyInput,
        storage: &dyn ConceptStorage,
    ) -> Result<CommentReplyOutput, Box<dyn std::error::Error>>;

    async fn publish(
        &self,
        input: CommentPublishInput,
        storage: &dyn ConceptStorage,
    ) -> Result<CommentPublishOutput, Box<dyn std::error::Error>>;

    async fn unpublish(
        &self,
        input: CommentUnpublishInput,
        storage: &dyn ConceptStorage,
    ) -> Result<CommentUnpublishOutput, Box<dyn std::error::Error>>;

    async fn delete(
        &self,
        input: CommentDeleteInput,
        storage: &dyn ConceptStorage,
    ) -> Result<CommentDeleteOutput, Box<dyn std::error::Error>>;

}
