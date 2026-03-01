// generated: swift_sdk_target/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait SwiftSdkTargetHandler: Send + Sync {
    async fn generate(
        &self,
        input: SwiftSdkTargetGenerateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SwiftSdkTargetGenerateOutput, Box<dyn std::error::Error>>;

}
