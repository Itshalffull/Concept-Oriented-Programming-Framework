// generated: causal_clock/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait CausalClockHandler: Send + Sync {
    async fn tick(
        &self,
        input: CausalClockTickInput,
        storage: &dyn ConceptStorage,
    ) -> Result<CausalClockTickOutput, Box<dyn std::error::Error>>;

    async fn merge(
        &self,
        input: CausalClockMergeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<CausalClockMergeOutput, Box<dyn std::error::Error>>;

    async fn compare(
        &self,
        input: CausalClockCompareInput,
        storage: &dyn ConceptStorage,
    ) -> Result<CausalClockCompareOutput, Box<dyn std::error::Error>>;

    async fn dominates(
        &self,
        input: CausalClockDominatesInput,
        storage: &dyn ConceptStorage,
    ) -> Result<CausalClockDominatesOutput, Box<dyn std::error::Error>>;

}
