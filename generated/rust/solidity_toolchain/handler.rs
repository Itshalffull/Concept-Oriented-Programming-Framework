// generated: solidity_toolchain/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait SolidityToolchainHandler: Send + Sync {
    async fn resolve(
        &self,
        input: SolidityToolchainResolveInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SolidityToolchainResolveOutput, Box<dyn std::error::Error>>;

    async fn register(
        &self,
        input: SolidityToolchainRegisterInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SolidityToolchainRegisterOutput, Box<dyn std::error::Error>>;

}
