// generated: content_node/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait ContentNodeHandler: Send + Sync {
    async fn create(
        &self,
        input: ContentNodeCreateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ContentNodeCreateOutput, Box<dyn std::error::Error>>;

    async fn update(
        &self,
        input: ContentNodeUpdateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ContentNodeUpdateOutput, Box<dyn std::error::Error>>;

    async fn delete(
        &self,
        input: ContentNodeDeleteInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ContentNodeDeleteOutput, Box<dyn std::error::Error>>;

    async fn get(
        &self,
        input: ContentNodeGetInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ContentNodeGetOutput, Box<dyn std::error::Error>>;

    async fn set_metadata(
        &self,
        input: ContentNodeSetMetadataInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ContentNodeSetMetadataOutput, Box<dyn std::error::Error>>;

    async fn change_type(
        &self,
        input: ContentNodeChangeTypeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ContentNodeChangeTypeOutput, Box<dyn std::error::Error>>;

}
