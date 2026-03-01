// generated: concept_scope_provider/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait ConceptScopeProviderHandler: Send + Sync {
    async fn initialize(
        &self,
        input: ConceptScopeProviderInitializeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ConceptScopeProviderInitializeOutput, Box<dyn std::error::Error>>;

}
