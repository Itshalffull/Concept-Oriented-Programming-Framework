// generated: lattice_merge/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait LatticeMergeHandler: Send + Sync {
    async fn register(
        &self,
        input: LatticeMergeRegisterInput,
        storage: &dyn ConceptStorage,
    ) -> Result<LatticeMergeRegisterOutput, Box<dyn std::error::Error>>;

    async fn execute(
        &self,
        input: LatticeMergeExecuteInput,
        storage: &dyn ConceptStorage,
    ) -> Result<LatticeMergeExecuteOutput, Box<dyn std::error::Error>>;

}
