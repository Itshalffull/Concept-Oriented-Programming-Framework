// generated: type_script_builder/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait TypeScriptBuilderHandler: Send + Sync {
    async fn build(
        &self,
        input: TypeScriptBuilderBuildInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TypeScriptBuilderBuildOutput, Box<dyn std::error::Error>>;

    async fn test(
        &self,
        input: TypeScriptBuilderTestInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TypeScriptBuilderTestOutput, Box<dyn std::error::Error>>;

    async fn package(
        &self,
        input: TypeScriptBuilderPackageInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TypeScriptBuilderPackageOutput, Box<dyn std::error::Error>>;

    async fn register(
        &self,
        input: TypeScriptBuilderRegisterInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TypeScriptBuilderRegisterOutput, Box<dyn std::error::Error>>;

}
