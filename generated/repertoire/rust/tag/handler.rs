// generated: tag/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait TagHandler: Send + Sync {
    async fn add_tag(
        &self,
        input: TagAddTagInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TagAddTagOutput, Box<dyn std::error::Error>>;

    async fn remove_tag(
        &self,
        input: TagRemoveTagInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TagRemoveTagOutput, Box<dyn std::error::Error>>;

    async fn get_by_tag(
        &self,
        input: TagGetByTagInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TagGetByTagOutput, Box<dyn std::error::Error>>;

    async fn get_children(
        &self,
        input: TagGetChildrenInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TagGetChildrenOutput, Box<dyn std::error::Error>>;

    async fn rename(
        &self,
        input: TagRenameInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TagRenameOutput, Box<dyn std::error::Error>>;

}
