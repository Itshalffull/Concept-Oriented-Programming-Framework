// generated: graph_traversal_analysis_provider/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait GraphTraversalAnalysisProviderHandler: Send + Sync {
    async fn initialize(
        &self,
        input: GraphTraversalAnalysisProviderInitializeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<GraphTraversalAnalysisProviderInitializeOutput, Box<dyn std::error::Error>>;

}
