// generated: process_metric/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait ProcessMetricHandler: Send + Sync {
    async fn record(
        &self,
        input: ProcessMetricRecordInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ProcessMetricRecordOutput, Box<dyn std::error::Error>>;

    async fn query(
        &self,
        input: ProcessMetricQueryInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ProcessMetricQueryOutput, Box<dyn std::error::Error>>;

    async fn aggregate(
        &self,
        input: ProcessMetricAggregateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ProcessMetricAggregateOutput, Box<dyn std::error::Error>>;
}
