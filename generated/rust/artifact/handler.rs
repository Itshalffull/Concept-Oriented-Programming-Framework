// generated: artifact/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait ArtifactHandler: Send + Sync {
    async fn build(
        &self,
        input: ArtifactBuildInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ArtifactBuildOutput, Box<dyn std::error::Error>>;

    async fn store(
        &self,
        input: ArtifactStoreInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ArtifactStoreOutput, Box<dyn std::error::Error>>;

    async fn resolve(
        &self,
        input: ArtifactResolveInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ArtifactResolveOutput, Box<dyn std::error::Error>>;

    async fn gc(
        &self,
        input: ArtifactGcInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ArtifactGcOutput, Box<dyn std::error::Error>>;

}
