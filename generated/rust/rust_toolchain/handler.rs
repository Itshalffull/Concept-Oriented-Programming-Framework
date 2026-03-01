// generated: rust_toolchain/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait RustToolchainHandler: Send + Sync {
    async fn resolve(
        &self,
        input: RustToolchainResolveInput,
        storage: &dyn ConceptStorage,
    ) -> Result<RustToolchainResolveOutput, Box<dyn std::error::Error>>;

    async fn register(
        &self,
        input: RustToolchainRegisterInput,
        storage: &dyn ConceptStorage,
    ) -> Result<RustToolchainRegisterOutput, Box<dyn std::error::Error>>;

}
