// generated: binding_dependence_provider/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait BindingDependenceProviderHandler: Send + Sync {
    async fn initialize(
        &self,
        input: BindingDependenceProviderInitializeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<BindingDependenceProviderInitializeOutput, Box<dyn std::error::Error>>;

}
