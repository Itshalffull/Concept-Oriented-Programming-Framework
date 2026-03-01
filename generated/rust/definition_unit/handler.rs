// generated: definition_unit/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait DefinitionUnitHandler: Send + Sync {
    async fn extract(
        &self,
        input: DefinitionUnitExtractInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DefinitionUnitExtractOutput, Box<dyn std::error::Error>>;

    async fn find_by_symbol(
        &self,
        input: DefinitionUnitFindBySymbolInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DefinitionUnitFindBySymbolOutput, Box<dyn std::error::Error>>;

    async fn find_by_pattern(
        &self,
        input: DefinitionUnitFindByPatternInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DefinitionUnitFindByPatternOutput, Box<dyn std::error::Error>>;

    async fn diff(
        &self,
        input: DefinitionUnitDiffInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DefinitionUnitDiffOutput, Box<dyn std::error::Error>>;

}
