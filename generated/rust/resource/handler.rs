// generated: resource/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait ResourceHandler: Send + Sync {
    async fn upsert(
        &self,
        input: ResourceUpsertInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ResourceUpsertOutput, Box<dyn std::error::Error>>;

    async fn get(
        &self,
        input: ResourceGetInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ResourceGetOutput, Box<dyn std::error::Error>>;

    async fn list(
        &self,
        input: ResourceListInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ResourceListOutput, Box<dyn std::error::Error>>;

    async fn remove(
        &self,
        input: ResourceRemoveInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ResourceRemoveOutput, Box<dyn std::error::Error>>;

    async fn diff(
        &self,
        input: ResourceDiffInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ResourceDiffOutput, Box<dyn std::error::Error>>;

}
