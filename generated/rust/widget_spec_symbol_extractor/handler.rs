// generated: widget_spec_symbol_extractor/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait WidgetSpecSymbolExtractorHandler: Send + Sync {
    async fn initialize(
        &self,
        input: WidgetSpecSymbolExtractorInitializeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<WidgetSpecSymbolExtractorInitializeOutput, Box<dyn std::error::Error>>;

}
