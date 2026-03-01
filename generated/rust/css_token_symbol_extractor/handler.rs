// generated: css_token_symbol_extractor/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait CssTokenSymbolExtractorHandler: Send + Sync {
    async fn initialize(
        &self,
        input: CssTokenSymbolExtractorInitializeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<CssTokenSymbolExtractorInitializeOutput, Box<dyn std::error::Error>>;

}
