// generated: toolchain/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait ToolchainHandler: Send + Sync {
    async fn resolve(
        &self,
        input: ToolchainResolveInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ToolchainResolveOutput, Box<dyn std::error::Error>>;

    async fn validate(
        &self,
        input: ToolchainValidateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ToolchainValidateOutput, Box<dyn std::error::Error>>;

    async fn list(
        &self,
        input: ToolchainListInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ToolchainListOutput, Box<dyn std::error::Error>>;

    async fn capabilities(
        &self,
        input: ToolchainCapabilitiesInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ToolchainCapabilitiesOutput, Box<dyn std::error::Error>>;

}
