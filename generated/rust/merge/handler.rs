// generated: merge/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait MergeHandler: Send + Sync {
    async fn register_strategy(
        &self,
        input: MergeRegisterStrategyInput,
        storage: &dyn ConceptStorage,
    ) -> Result<MergeRegisterStrategyOutput, Box<dyn std::error::Error>>;

    async fn merge(
        &self,
        input: MergeMergeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<MergeMergeOutput, Box<dyn std::error::Error>>;

    async fn resolve_conflict(
        &self,
        input: MergeResolveConflictInput,
        storage: &dyn ConceptStorage,
    ) -> Result<MergeResolveConflictOutput, Box<dyn std::error::Error>>;

    async fn finalize(
        &self,
        input: MergeFinalizeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<MergeFinalizeOutput, Box<dyn std::error::Error>>;

}
