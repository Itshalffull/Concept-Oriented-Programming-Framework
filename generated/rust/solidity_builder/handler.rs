// generated: solidity_builder/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait SolidityBuilderHandler: Send + Sync {
    async fn build(
        &self,
        input: SolidityBuilderBuildInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SolidityBuilderBuildOutput, Box<dyn std::error::Error>>;

    async fn test(
        &self,
        input: SolidityBuilderTestInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SolidityBuilderTestOutput, Box<dyn std::error::Error>>;

    async fn package(
        &self,
        input: SolidityBuilderPackageInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SolidityBuilderPackageOutput, Box<dyn std::error::Error>>;

    async fn register(
        &self,
        input: SolidityBuilderRegisterInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SolidityBuilderRegisterOutput, Box<dyn std::error::Error>>;

}
