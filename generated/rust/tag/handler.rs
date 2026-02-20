// generated: tag/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait TagHandler: Send + Sync {
    async fn add(
        &self,
        input: TagAddInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TagAddOutput, Box<dyn std::error::Error>>;

    async fn remove(
        &self,
        input: TagRemoveInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TagRemoveOutput, Box<dyn std::error::Error>>;

    async fn list(
        &self,
        input: TagListInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TagListOutput, Box<dyn std::error::Error>>;

}
