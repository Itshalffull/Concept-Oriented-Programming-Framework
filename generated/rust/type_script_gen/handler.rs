// generated: type_script_gen/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait TypeScriptGenHandler: Send + Sync {
    async fn generate(
        &self,
        input: TypeScriptGenGenerateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TypeScriptGenGenerateOutput, Box<dyn std::error::Error>>;

}
