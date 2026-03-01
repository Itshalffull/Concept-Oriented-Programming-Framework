// generated: cli_target/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait CliTargetHandler: Send + Sync {
    async fn generate(
        &self,
        input: CliTargetGenerateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<CliTargetGenerateOutput, Box<dyn std::error::Error>>;

    async fn validate(
        &self,
        input: CliTargetValidateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<CliTargetValidateOutput, Box<dyn std::error::Error>>;

    async fn list_commands(
        &self,
        input: CliTargetListCommandsInput,
        storage: &dyn ConceptStorage,
    ) -> Result<CliTargetListCommandsOutput, Box<dyn std::error::Error>>;

}
