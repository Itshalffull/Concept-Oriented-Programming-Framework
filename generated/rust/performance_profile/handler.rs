// generated: performance_profile/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait PerformanceProfileHandler: Send + Sync {
    async fn aggregate(
        &self,
        input: PerformanceProfileAggregateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<PerformanceProfileAggregateOutput, Box<dyn std::error::Error>>;

    async fn hotspots(
        &self,
        input: PerformanceProfileHotspotsInput,
        storage: &dyn ConceptStorage,
    ) -> Result<PerformanceProfileHotspotsOutput, Box<dyn std::error::Error>>;

    async fn slow_chains(
        &self,
        input: PerformanceProfileSlowChainsInput,
        storage: &dyn ConceptStorage,
    ) -> Result<PerformanceProfileSlowChainsOutput, Box<dyn std::error::Error>>;

    async fn compare_windows(
        &self,
        input: PerformanceProfileCompareWindowsInput,
        storage: &dyn ConceptStorage,
    ) -> Result<PerformanceProfileCompareWindowsOutput, Box<dyn std::error::Error>>;

    async fn get(
        &self,
        input: PerformanceProfileGetInput,
        storage: &dyn ConceptStorage,
    ) -> Result<PerformanceProfileGetOutput, Box<dyn std::error::Error>>;

}
