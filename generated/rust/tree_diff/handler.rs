// generated: tree_diff/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait TreeDiffHandler: Send + Sync {
    async fn register(
        &self,
        input: TreeDiffRegisterInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TreeDiffRegisterOutput, Box<dyn std::error::Error>>;

    async fn compute(
        &self,
        input: TreeDiffComputeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TreeDiffComputeOutput, Box<dyn std::error::Error>>;

}
