// generated: ref/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait RefHandler: Send + Sync {
    async fn create(
        &self,
        input: RefCreateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<RefCreateOutput, Box<dyn std::error::Error>>;

    async fn update(
        &self,
        input: RefUpdateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<RefUpdateOutput, Box<dyn std::error::Error>>;

    async fn delete(
        &self,
        input: RefDeleteInput,
        storage: &dyn ConceptStorage,
    ) -> Result<RefDeleteOutput, Box<dyn std::error::Error>>;

    async fn resolve(
        &self,
        input: RefResolveInput,
        storage: &dyn ConceptStorage,
    ) -> Result<RefResolveOutput, Box<dyn std::error::Error>>;

    async fn log(
        &self,
        input: RefLogInput,
        storage: &dyn ConceptStorage,
    ) -> Result<RefLogOutput, Box<dyn std::error::Error>>;

}
