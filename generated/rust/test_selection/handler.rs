// generated: test_selection/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait TestSelectionHandler: Send + Sync {
    async fn analyze(
        &self,
        input: TestSelectionAnalyzeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TestSelectionAnalyzeOutput, Box<dyn std::error::Error>>;

    async fn select(
        &self,
        input: TestSelectionSelectInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TestSelectionSelectOutput, Box<dyn std::error::Error>>;

    async fn record(
        &self,
        input: TestSelectionRecordInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TestSelectionRecordOutput, Box<dyn std::error::Error>>;

    async fn statistics(
        &self,
        input: TestSelectionStatisticsInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TestSelectionStatisticsOutput, Box<dyn std::error::Error>>;

}
