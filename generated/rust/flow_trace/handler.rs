// generated: flow_trace/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait FlowTraceHandler: Send + Sync {
    async fn build(
        &self,
        input: FlowTraceBuildInput,
        storage: &dyn ConceptStorage,
    ) -> Result<FlowTraceBuildOutput, Box<dyn std::error::Error>>;

    async fn render(
        &self,
        input: FlowTraceRenderInput,
        storage: &dyn ConceptStorage,
    ) -> Result<FlowTraceRenderOutput, Box<dyn std::error::Error>>;

}
