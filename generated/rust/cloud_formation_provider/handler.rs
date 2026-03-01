// generated: cloud_formation_provider/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait CloudFormationProviderHandler: Send + Sync {
    async fn generate(
        &self,
        input: CloudFormationProviderGenerateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<CloudFormationProviderGenerateOutput, Box<dyn std::error::Error>>;

    async fn preview(
        &self,
        input: CloudFormationProviderPreviewInput,
        storage: &dyn ConceptStorage,
    ) -> Result<CloudFormationProviderPreviewOutput, Box<dyn std::error::Error>>;

    async fn apply(
        &self,
        input: CloudFormationProviderApplyInput,
        storage: &dyn ConceptStorage,
    ) -> Result<CloudFormationProviderApplyOutput, Box<dyn std::error::Error>>;

    async fn teardown(
        &self,
        input: CloudFormationProviderTeardownInput,
        storage: &dyn ConceptStorage,
    ) -> Result<CloudFormationProviderTeardownOutput, Box<dyn std::error::Error>>;

}
