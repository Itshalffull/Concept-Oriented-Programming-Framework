// generated: collection/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait CollectionHandler: Send + Sync {
    async fn create(
        &self,
        input: CollectionCreateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<CollectionCreateOutput, Box<dyn std::error::Error>>;

    async fn add_member(
        &self,
        input: CollectionAddMemberInput,
        storage: &dyn ConceptStorage,
    ) -> Result<CollectionAddMemberOutput, Box<dyn std::error::Error>>;

    async fn remove_member(
        &self,
        input: CollectionRemoveMemberInput,
        storage: &dyn ConceptStorage,
    ) -> Result<CollectionRemoveMemberOutput, Box<dyn std::error::Error>>;

    async fn get_members(
        &self,
        input: CollectionGetMembersInput,
        storage: &dyn ConceptStorage,
    ) -> Result<CollectionGetMembersOutput, Box<dyn std::error::Error>>;

    async fn set_schema(
        &self,
        input: CollectionSetSchemaInput,
        storage: &dyn ConceptStorage,
    ) -> Result<CollectionSetSchemaOutput, Box<dyn std::error::Error>>;

    async fn create_virtual(
        &self,
        input: CollectionCreateVirtualInput,
        storage: &dyn ConceptStorage,
    ) -> Result<CollectionCreateVirtualOutput, Box<dyn std::error::Error>>;

    async fn materialize(
        &self,
        input: CollectionMaterializeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<CollectionMaterializeOutput, Box<dyn std::error::Error>>;

}
