// generated: symbol_index_provider/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait SymbolIndexProviderHandler: Send + Sync {
    async fn initialize(
        &self,
        input: SymbolIndexProviderInitializeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SymbolIndexProviderInitializeOutput, Box<dyn std::error::Error>>;

}
