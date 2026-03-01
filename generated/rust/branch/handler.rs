// generated: branch/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait BranchHandler: Send + Sync {
    async fn create(
        &self,
        input: BranchCreateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<BranchCreateOutput, Box<dyn std::error::Error>>;

    async fn advance(
        &self,
        input: BranchAdvanceInput,
        storage: &dyn ConceptStorage,
    ) -> Result<BranchAdvanceOutput, Box<dyn std::error::Error>>;

    async fn delete(
        &self,
        input: BranchDeleteInput,
        storage: &dyn ConceptStorage,
    ) -> Result<BranchDeleteOutput, Box<dyn std::error::Error>>;

    async fn protect(
        &self,
        input: BranchProtectInput,
        storage: &dyn ConceptStorage,
    ) -> Result<BranchProtectOutput, Box<dyn std::error::Error>>;

    async fn set_upstream(
        &self,
        input: BranchSetUpstreamInput,
        storage: &dyn ConceptStorage,
    ) -> Result<BranchSetUpstreamOutput, Box<dyn std::error::Error>>;

    async fn divergence_point(
        &self,
        input: BranchDivergencePointInput,
        storage: &dyn ConceptStorage,
    ) -> Result<BranchDivergencePointOutput, Box<dyn std::error::Error>>;

    async fn archive(
        &self,
        input: BranchArchiveInput,
        storage: &dyn ConceptStorage,
    ) -> Result<BranchArchiveOutput, Box<dyn std::error::Error>>;

}
