// generated: recursive_merge/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait RecursiveMergeHandler: Send + Sync {
    async fn register(
        &self,
        input: RecursiveMergeRegisterInput,
        storage: &dyn ConceptStorage,
    ) -> Result<RecursiveMergeRegisterOutput, Box<dyn std::error::Error>>;

    async fn execute(
        &self,
        input: RecursiveMergeExecuteInput,
        storage: &dyn ConceptStorage,
    ) -> Result<RecursiveMergeExecuteOutput, Box<dyn std::error::Error>>;

}
