// generated: type_script_symbol_extractor/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait TypeScriptSymbolExtractorHandler: Send + Sync {
    async fn initialize(
        &self,
        input: TypeScriptSymbolExtractorInitializeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TypeScriptSymbolExtractorInitializeOutput, Box<dyn std::error::Error>>;

}
