// generated: symbol_relationship/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait SymbolRelationshipHandler: Send + Sync {
    async fn add(
        &self,
        input: SymbolRelationshipAddInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SymbolRelationshipAddOutput, Box<dyn std::error::Error>>;

    async fn find_from(
        &self,
        input: SymbolRelationshipFindFromInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SymbolRelationshipFindFromOutput, Box<dyn std::error::Error>>;

    async fn find_to(
        &self,
        input: SymbolRelationshipFindToInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SymbolRelationshipFindToOutput, Box<dyn std::error::Error>>;

    async fn transitive_closure(
        &self,
        input: SymbolRelationshipTransitiveClosureInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SymbolRelationshipTransitiveClosureOutput, Box<dyn std::error::Error>>;

    async fn get(
        &self,
        input: SymbolRelationshipGetInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SymbolRelationshipGetOutput, Box<dyn std::error::Error>>;

}
