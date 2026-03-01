// generated: terraform_provider/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait TerraformProviderHandler: Send + Sync {
    async fn generate(
        &self,
        input: TerraformProviderGenerateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TerraformProviderGenerateOutput, Box<dyn std::error::Error>>;

    async fn preview(
        &self,
        input: TerraformProviderPreviewInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TerraformProviderPreviewOutput, Box<dyn std::error::Error>>;

    async fn apply(
        &self,
        input: TerraformProviderApplyInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TerraformProviderApplyOutput, Box<dyn std::error::Error>>;

    async fn teardown(
        &self,
        input: TerraformProviderTeardownInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TerraformProviderTeardownOutput, Box<dyn std::error::Error>>;

}
