// generated: selection_pipeline_dependence_provider/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait SelectionPipelineDependenceProviderHandler: Send + Sync {
    async fn initialize(
        &self,
        input: SelectionPipelineDependenceProviderInitializeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SelectionPipelineDependenceProviderInitializeOutput, Box<dyn std::error::Error>>;

}
