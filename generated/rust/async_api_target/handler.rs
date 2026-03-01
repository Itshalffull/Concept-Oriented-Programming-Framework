// generated: async_api_target/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait AsyncApiTargetHandler: Send + Sync {
    async fn generate(
        &self,
        input: AsyncApiTargetGenerateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<AsyncApiTargetGenerateOutput, Box<dyn std::error::Error>>;

}
