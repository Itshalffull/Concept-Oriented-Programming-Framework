// generated: concept_spec_symbol_extractor/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait ConceptSpecSymbolExtractorHandler: Send + Sync {
    async fn initialize(
        &self,
        input: ConceptSpecSymbolExtractorInitializeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ConceptSpecSymbolExtractorInitializeOutput, Box<dyn std::error::Error>>;

}
