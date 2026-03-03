// generated: quality_signal/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait QualitySignalHandler: Send + Sync {
    async fn record(
        &self,
        input: QualitySignalRecordInput,
        storage: &dyn ConceptStorage,
    ) -> Result<QualitySignalRecordOutput, Box<dyn std::error::Error>>;

    async fn latest(
        &self,
        input: QualitySignalLatestInput,
        storage: &dyn ConceptStorage,
    ) -> Result<QualitySignalLatestOutput, Box<dyn std::error::Error>>;

    async fn rollup(
        &self,
        input: QualitySignalRollupInput,
        storage: &dyn ConceptStorage,
    ) -> Result<QualitySignalRollupOutput, Box<dyn std::error::Error>>;

    async fn explain(
        &self,
        input: QualitySignalExplainInput,
        storage: &dyn ConceptStorage,
    ) -> Result<QualitySignalExplainOutput, Box<dyn std::error::Error>>;

}