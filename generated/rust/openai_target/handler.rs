// generated: openai_target/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait OpenaiTargetHandler: Send + Sync {
    async fn generate(
        &self,
        input: OpenaiTargetGenerateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<OpenaiTargetGenerateOutput, Box<dyn std::error::Error>>;

    async fn validate(
        &self,
        input: OpenaiTargetValidateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<OpenaiTargetValidateOutput, Box<dyn std::error::Error>>;

    async fn list_functions(
        &self,
        input: OpenaiTargetListFunctionsInput,
        storage: &dyn ConceptStorage,
    ) -> Result<OpenaiTargetListFunctionsOutput, Box<dyn std::error::Error>>;

}
