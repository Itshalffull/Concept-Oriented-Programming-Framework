// generated: data_flow_path/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait DataFlowPathHandler: Send + Sync {
    async fn trace(
        &self,
        input: DataFlowPathTraceInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DataFlowPathTraceOutput, Box<dyn std::error::Error>>;

    async fn trace_from_config(
        &self,
        input: DataFlowPathTraceFromConfigInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DataFlowPathTraceFromConfigOutput, Box<dyn std::error::Error>>;

    async fn trace_to_output(
        &self,
        input: DataFlowPathTraceToOutputInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DataFlowPathTraceToOutputOutput, Box<dyn std::error::Error>>;

    async fn get(
        &self,
        input: DataFlowPathGetInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DataFlowPathGetOutput, Box<dyn std::error::Error>>;

}
