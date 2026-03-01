// generated: react_component_symbol_extractor/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait ReactComponentSymbolExtractorHandler: Send + Sync {
    async fn initialize(
        &self,
        input: ReactComponentSymbolExtractorInitializeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ReactComponentSymbolExtractorInitializeOutput, Box<dyn std::error::Error>>;

}
