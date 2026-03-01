// generated: three_way_merge/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait ThreeWayMergeHandler: Send + Sync {
    async fn register(
        &self,
        input: ThreeWayMergeRegisterInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ThreeWayMergeRegisterOutput, Box<dyn std::error::Error>>;

    async fn execute(
        &self,
        input: ThreeWayMergeExecuteInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ThreeWayMergeExecuteOutput, Box<dyn std::error::Error>>;

}
