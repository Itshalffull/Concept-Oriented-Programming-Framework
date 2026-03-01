// generated: type_script_dependence_provider/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait TypeScriptDependenceProviderHandler: Send + Sync {
    async fn initialize(
        &self,
        input: TypeScriptDependenceProviderInitializeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TypeScriptDependenceProviderInitializeOutput, Box<dyn std::error::Error>>;

}
