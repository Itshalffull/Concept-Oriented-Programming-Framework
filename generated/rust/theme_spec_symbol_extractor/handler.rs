// generated: theme_spec_symbol_extractor/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait ThemeSpecSymbolExtractorHandler: Send + Sync {
    async fn initialize(
        &self,
        input: ThemeSpecSymbolExtractorInitializeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ThemeSpecSymbolExtractorInitializeOutput, Box<dyn std::error::Error>>;

}
