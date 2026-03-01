// generated: builder/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait BuilderHandler: Send + Sync {
    async fn build(
        &self,
        input: BuilderBuildInput,
        storage: &dyn ConceptStorage,
    ) -> Result<BuilderBuildOutput, Box<dyn std::error::Error>>;

    async fn build_all(
        &self,
        input: BuilderBuildAllInput,
        storage: &dyn ConceptStorage,
    ) -> Result<BuilderBuildAllOutput, Box<dyn std::error::Error>>;

    async fn test(
        &self,
        input: BuilderTestInput,
        storage: &dyn ConceptStorage,
    ) -> Result<BuilderTestOutput, Box<dyn std::error::Error>>;

    async fn status(
        &self,
        input: BuilderStatusInput,
        storage: &dyn ConceptStorage,
    ) -> Result<BuilderStatusOutput, Box<dyn std::error::Error>>;

    async fn history(
        &self,
        input: BuilderHistoryInput,
        storage: &dyn ConceptStorage,
    ) -> Result<BuilderHistoryOutput, Box<dyn std::error::Error>>;

}
