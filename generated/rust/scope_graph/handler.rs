// generated: scope_graph/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait ScopeGraphHandler: Send + Sync {
    async fn build(
        &self,
        input: ScopeGraphBuildInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ScopeGraphBuildOutput, Box<dyn std::error::Error>>;

    async fn resolve_reference(
        &self,
        input: ScopeGraphResolveReferenceInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ScopeGraphResolveReferenceOutput, Box<dyn std::error::Error>>;

    async fn visible_symbols(
        &self,
        input: ScopeGraphVisibleSymbolsInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ScopeGraphVisibleSymbolsOutput, Box<dyn std::error::Error>>;

    async fn resolve_cross_file(
        &self,
        input: ScopeGraphResolveCrossFileInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ScopeGraphResolveCrossFileOutput, Box<dyn std::error::Error>>;

    async fn get(
        &self,
        input: ScopeGraphGetInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ScopeGraphGetOutput, Box<dyn std::error::Error>>;

}
