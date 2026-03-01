// generated: java_sdk_target/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait JavaSdkTargetHandler: Send + Sync {
    async fn generate(
        &self,
        input: JavaSdkTargetGenerateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<JavaSdkTargetGenerateOutput, Box<dyn std::error::Error>>;

}
