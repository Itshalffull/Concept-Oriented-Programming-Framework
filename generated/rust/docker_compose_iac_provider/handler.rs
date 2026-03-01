// generated: docker_compose_iac_provider/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait DockerComposeIacProviderHandler: Send + Sync {
    async fn generate(
        &self,
        input: DockerComposeIacProviderGenerateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DockerComposeIacProviderGenerateOutput, Box<dyn std::error::Error>>;

    async fn preview(
        &self,
        input: DockerComposeIacProviderPreviewInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DockerComposeIacProviderPreviewOutput, Box<dyn std::error::Error>>;

    async fn apply(
        &self,
        input: DockerComposeIacProviderApplyInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DockerComposeIacProviderApplyOutput, Box<dyn std::error::Error>>;

    async fn teardown(
        &self,
        input: DockerComposeIacProviderTeardownInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DockerComposeIacProviderTeardownOutput, Box<dyn std::error::Error>>;

}
