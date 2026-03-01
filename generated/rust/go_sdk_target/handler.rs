// generated: go_sdk_target/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait GoSdkTargetHandler: Send + Sync {
    async fn generate(
        &self,
        input: GoSdkTargetGenerateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<GoSdkTargetGenerateOutput, Box<dyn std::error::Error>>;

}
