// generated: type_script_scope_provider/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait TypeScriptScopeProviderHandler: Send + Sync {
    async fn initialize(
        &self,
        input: TypeScriptScopeProviderInitializeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TypeScriptScopeProviderInitializeOutput, Box<dyn std::error::Error>>;

}
