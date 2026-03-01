// generated: histogram_diff/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait HistogramDiffHandler: Send + Sync {
    async fn register(
        &self,
        input: HistogramDiffRegisterInput,
        storage: &dyn ConceptStorage,
    ) -> Result<HistogramDiffRegisterOutput, Box<dyn std::error::Error>>;

    async fn compute(
        &self,
        input: HistogramDiffComputeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<HistogramDiffComputeOutput, Box<dyn std::error::Error>>;

}
