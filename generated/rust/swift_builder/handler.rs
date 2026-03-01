// generated: swift_builder/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait SwiftBuilderHandler: Send + Sync {
    async fn build(
        &self,
        input: SwiftBuilderBuildInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SwiftBuilderBuildOutput, Box<dyn std::error::Error>>;

    async fn test(
        &self,
        input: SwiftBuilderTestInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SwiftBuilderTestOutput, Box<dyn std::error::Error>>;

    async fn package(
        &self,
        input: SwiftBuilderPackageInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SwiftBuilderPackageOutput, Box<dyn std::error::Error>>;

    async fn register(
        &self,
        input: SwiftBuilderRegisterInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SwiftBuilderRegisterOutput, Box<dyn std::error::Error>>;

}
