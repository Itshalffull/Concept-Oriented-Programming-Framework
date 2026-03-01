// generated: myers_diff/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait MyersDiffHandler: Send + Sync {
    async fn register(
        &self,
        input: MyersDiffRegisterInput,
        storage: &dyn ConceptStorage,
    ) -> Result<MyersDiffRegisterOutput, Box<dyn std::error::Error>>;

    async fn compute(
        &self,
        input: MyersDiffComputeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<MyersDiffComputeOutput, Box<dyn std::error::Error>>;

}
