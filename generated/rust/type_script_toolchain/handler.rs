// generated: type_script_toolchain/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait TypeScriptToolchainHandler: Send + Sync {
    async fn resolve(
        &self,
        input: TypeScriptToolchainResolveInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TypeScriptToolchainResolveOutput, Box<dyn std::error::Error>>;

    async fn register(
        &self,
        input: TypeScriptToolchainRegisterInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TypeScriptToolchainRegisterOutput, Box<dyn std::error::Error>>;

}
