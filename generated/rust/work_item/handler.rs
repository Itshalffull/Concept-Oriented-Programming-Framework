// WorkItem concept handler trait
// Defines the async interface for work item lifecycle management.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait WorkItemHandler: Send + Sync {
    async fn create(
        &self,
        input: WorkItemCreateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<WorkItemCreateOutput, Box<dyn std::error::Error>>;

    async fn claim(
        &self,
        input: WorkItemClaimInput,
        storage: &dyn ConceptStorage,
    ) -> Result<WorkItemClaimOutput, Box<dyn std::error::Error>>;

    async fn start(
        &self,
        input: WorkItemStartInput,
        storage: &dyn ConceptStorage,
    ) -> Result<WorkItemStartOutput, Box<dyn std::error::Error>>;

    async fn complete(
        &self,
        input: WorkItemCompleteInput,
        storage: &dyn ConceptStorage,
    ) -> Result<WorkItemCompleteOutput, Box<dyn std::error::Error>>;

    async fn reject(
        &self,
        input: WorkItemRejectInput,
        storage: &dyn ConceptStorage,
    ) -> Result<WorkItemRejectOutput, Box<dyn std::error::Error>>;

    async fn delegate(
        &self,
        input: WorkItemDelegateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<WorkItemDelegateOutput, Box<dyn std::error::Error>>;

    async fn release(
        &self,
        input: WorkItemReleaseInput,
        storage: &dyn ConceptStorage,
    ) -> Result<WorkItemReleaseOutput, Box<dyn std::error::Error>>;
}
