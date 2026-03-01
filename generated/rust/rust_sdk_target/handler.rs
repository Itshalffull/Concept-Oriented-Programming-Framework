// generated: rust_sdk_target/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait RustSdkTargetHandler: Send + Sync {
    async fn generate(
        &self,
        input: RustSdkTargetGenerateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<RustSdkTargetGenerateOutput, Box<dyn std::error::Error>>;

}
