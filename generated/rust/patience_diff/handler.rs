// generated: patience_diff/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait PatienceDiffHandler: Send + Sync {
    async fn register(
        &self,
        input: PatienceDiffRegisterInput,
        storage: &dyn ConceptStorage,
    ) -> Result<PatienceDiffRegisterOutput, Box<dyn std::error::Error>>;

    async fn compute(
        &self,
        input: PatienceDiffComputeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<PatienceDiffComputeOutput, Box<dyn std::error::Error>>;

}
