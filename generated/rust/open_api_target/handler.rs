// generated: open_api_target/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait OpenApiTargetHandler: Send + Sync {
    async fn generate(
        &self,
        input: OpenApiTargetGenerateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<OpenApiTargetGenerateOutput, Box<dyn std::error::Error>>;

}
