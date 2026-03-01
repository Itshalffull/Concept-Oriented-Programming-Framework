// generated: nextjs_sdk_target/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait NextjsSdkTargetHandler: Send + Sync {
    async fn generate(
        &self,
        input: NextjsSdkTargetGenerateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<NextjsSdkTargetGenerateOutput, Box<dyn std::error::Error>>;

}
