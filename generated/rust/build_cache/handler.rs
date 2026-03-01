// generated: build_cache/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait BuildCacheHandler: Send + Sync {
    async fn check(
        &self,
        input: BuildCacheCheckInput,
        storage: &dyn ConceptStorage,
    ) -> Result<BuildCacheCheckOutput, Box<dyn std::error::Error>>;

    async fn record(
        &self,
        input: BuildCacheRecordInput,
        storage: &dyn ConceptStorage,
    ) -> Result<BuildCacheRecordOutput, Box<dyn std::error::Error>>;

    async fn invalidate(
        &self,
        input: BuildCacheInvalidateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<BuildCacheInvalidateOutput, Box<dyn std::error::Error>>;

    async fn invalidate_by_source(
        &self,
        input: BuildCacheInvalidateBySourceInput,
        storage: &dyn ConceptStorage,
    ) -> Result<BuildCacheInvalidateBySourceOutput, Box<dyn std::error::Error>>;

    async fn invalidate_by_kind(
        &self,
        input: BuildCacheInvalidateByKindInput,
        storage: &dyn ConceptStorage,
    ) -> Result<BuildCacheInvalidateByKindOutput, Box<dyn std::error::Error>>;

    async fn invalidate_all(
        &self,
        input: BuildCacheInvalidateAllInput,
        storage: &dyn ConceptStorage,
    ) -> Result<BuildCacheInvalidateAllOutput, Box<dyn std::error::Error>>;

    async fn status(
        &self,
        input: BuildCacheStatusInput,
        storage: &dyn ConceptStorage,
    ) -> Result<BuildCacheStatusOutput, Box<dyn std::error::Error>>;

    async fn stale_steps(
        &self,
        input: BuildCacheStaleStepsInput,
        storage: &dyn ConceptStorage,
    ) -> Result<BuildCacheStaleStepsOutput, Box<dyn std::error::Error>>;

}
