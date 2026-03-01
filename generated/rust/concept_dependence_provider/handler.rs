// generated: concept_dependence_provider/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait ConceptDependenceProviderHandler: Send + Sync {
    async fn initialize(
        &self,
        input: ConceptDependenceProviderInitializeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ConceptDependenceProviderInitializeOutput, Box<dyn std::error::Error>>;

}
