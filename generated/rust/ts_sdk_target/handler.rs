// generated: ts_sdk_target/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait TsSdkTargetHandler: Send + Sync {
    async fn generate(
        &self,
        input: TsSdkTargetGenerateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TsSdkTargetGenerateOutput, Box<dyn std::error::Error>>;

}
