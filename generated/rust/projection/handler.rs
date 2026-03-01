// generated: projection/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait ProjectionHandler: Send + Sync {
    async fn project(
        &self,
        input: ProjectionProjectInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ProjectionProjectOutput, Box<dyn std::error::Error>>;

    async fn validate(
        &self,
        input: ProjectionValidateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ProjectionValidateOutput, Box<dyn std::error::Error>>;

    async fn diff(
        &self,
        input: ProjectionDiffInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ProjectionDiffOutput, Box<dyn std::error::Error>>;

    async fn infer_resources(
        &self,
        input: ProjectionInferResourcesInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ProjectionInferResourcesOutput, Box<dyn std::error::Error>>;

}
