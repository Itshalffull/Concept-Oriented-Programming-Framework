// generated: process_spec/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait ProcessSpecHandler: Send + Sync {
    async fn create(
        &self,
        input: ProcessSpecCreateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ProcessSpecCreateOutput, Box<dyn std::error::Error>>;

    async fn publish(
        &self,
        input: ProcessSpecPublishInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ProcessSpecPublishOutput, Box<dyn std::error::Error>>;

    async fn deprecate(
        &self,
        input: ProcessSpecDeprecateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ProcessSpecDeprecateOutput, Box<dyn std::error::Error>>;

    async fn update(
        &self,
        input: ProcessSpecUpdateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ProcessSpecUpdateOutput, Box<dyn std::error::Error>>;

    async fn get(
        &self,
        input: ProcessSpecGetInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ProcessSpecGetOutput, Box<dyn std::error::Error>>;
}
