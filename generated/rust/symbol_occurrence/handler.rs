// generated: symbol_occurrence/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait SymbolOccurrenceHandler: Send + Sync {
    async fn record(
        &self,
        input: SymbolOccurrenceRecordInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SymbolOccurrenceRecordOutput, Box<dyn std::error::Error>>;

    async fn find_definitions(
        &self,
        input: SymbolOccurrenceFindDefinitionsInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SymbolOccurrenceFindDefinitionsOutput, Box<dyn std::error::Error>>;

    async fn find_references(
        &self,
        input: SymbolOccurrenceFindReferencesInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SymbolOccurrenceFindReferencesOutput, Box<dyn std::error::Error>>;

    async fn find_at_position(
        &self,
        input: SymbolOccurrenceFindAtPositionInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SymbolOccurrenceFindAtPositionOutput, Box<dyn std::error::Error>>;

    async fn find_in_file(
        &self,
        input: SymbolOccurrenceFindInFileInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SymbolOccurrenceFindInFileOutput, Box<dyn std::error::Error>>;

}
