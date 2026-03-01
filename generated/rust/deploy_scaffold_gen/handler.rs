// generated: deploy_scaffold_gen/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait DeployScaffoldGenHandler: Send + Sync {
    async fn generate(
        &self,
        input: DeployScaffoldGenGenerateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DeployScaffoldGenGenerateOutput, Box<dyn std::error::Error>>;

    async fn preview(
        &self,
        input: DeployScaffoldGenPreviewInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DeployScaffoldGenPreviewOutput, Box<dyn std::error::Error>>;

    async fn register(
        &self,
        input: DeployScaffoldGenRegisterInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DeployScaffoldGenRegisterOutput, Box<dyn std::error::Error>>;

}
