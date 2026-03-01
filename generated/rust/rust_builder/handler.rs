// generated: rust_builder/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait RustBuilderHandler: Send + Sync {
    async fn build(
        &self,
        input: RustBuilderBuildInput,
        storage: &dyn ConceptStorage,
    ) -> Result<RustBuilderBuildOutput, Box<dyn std::error::Error>>;

    async fn test(
        &self,
        input: RustBuilderTestInput,
        storage: &dyn ConceptStorage,
    ) -> Result<RustBuilderTestOutput, Box<dyn std::error::Error>>;

    async fn package(
        &self,
        input: RustBuilderPackageInput,
        storage: &dyn ConceptStorage,
    ) -> Result<RustBuilderPackageOutput, Box<dyn std::error::Error>>;

    async fn register(
        &self,
        input: RustBuilderRegisterInput,
        storage: &dyn ConceptStorage,
    ) -> Result<RustBuilderRegisterOutput, Box<dyn std::error::Error>>;

}
