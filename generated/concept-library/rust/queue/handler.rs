// generated: queue/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait QueueHandler: Send + Sync {
    async fn enqueue(
        &self,
        input: QueueEnqueueInput,
        storage: &dyn ConceptStorage,
    ) -> Result<QueueEnqueueOutput, Box<dyn std::error::Error>>;

    async fn claim(
        &self,
        input: QueueClaimInput,
        storage: &dyn ConceptStorage,
    ) -> Result<QueueClaimOutput, Box<dyn std::error::Error>>;

    async fn process(
        &self,
        input: QueueProcessInput,
        storage: &dyn ConceptStorage,
    ) -> Result<QueueProcessOutput, Box<dyn std::error::Error>>;

    async fn release(
        &self,
        input: QueueReleaseInput,
        storage: &dyn ConceptStorage,
    ) -> Result<QueueReleaseOutput, Box<dyn std::error::Error>>;

    async fn delete(
        &self,
        input: QueueDeleteInput,
        storage: &dyn ConceptStorage,
    ) -> Result<QueueDeleteOutput, Box<dyn std::error::Error>>;

}
