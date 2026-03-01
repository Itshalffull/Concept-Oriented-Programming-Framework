// generated: sdk/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait SdkHandler: Send + Sync {
    async fn generate(
        &self,
        input: SdkGenerateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SdkGenerateOutput, Box<dyn std::error::Error>>;

    async fn publish(
        &self,
        input: SdkPublishInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SdkPublishOutput, Box<dyn std::error::Error>>;

}
