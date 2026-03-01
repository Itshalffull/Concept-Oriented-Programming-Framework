// generated: sync_spec_symbol_extractor/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait SyncSpecSymbolExtractorHandler: Send + Sync {
    async fn initialize(
        &self,
        input: SyncSpecSymbolExtractorInitializeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SyncSpecSymbolExtractorInitializeOutput, Box<dyn std::error::Error>>;

}
