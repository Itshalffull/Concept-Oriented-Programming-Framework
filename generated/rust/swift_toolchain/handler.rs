// generated: swift_toolchain/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait SwiftToolchainHandler: Send + Sync {
    async fn resolve(
        &self,
        input: SwiftToolchainResolveInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SwiftToolchainResolveOutput, Box<dyn std::error::Error>>;

    async fn register(
        &self,
        input: SwiftToolchainRegisterInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SwiftToolchainRegisterOutput, Box<dyn std::error::Error>>;

}
