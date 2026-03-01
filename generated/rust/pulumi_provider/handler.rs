// generated: pulumi_provider/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait PulumiProviderHandler: Send + Sync {
    async fn generate(
        &self,
        input: PulumiProviderGenerateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<PulumiProviderGenerateOutput, Box<dyn std::error::Error>>;

    async fn preview(
        &self,
        input: PulumiProviderPreviewInput,
        storage: &dyn ConceptStorage,
    ) -> Result<PulumiProviderPreviewOutput, Box<dyn std::error::Error>>;

    async fn apply(
        &self,
        input: PulumiProviderApplyInput,
        storage: &dyn ConceptStorage,
    ) -> Result<PulumiProviderApplyOutput, Box<dyn std::error::Error>>;

    async fn teardown(
        &self,
        input: PulumiProviderTeardownInput,
        storage: &dyn ConceptStorage,
    ) -> Result<PulumiProviderTeardownOutput, Box<dyn std::error::Error>>;

}
