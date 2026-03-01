// generated: mcp_target/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait McpTargetHandler: Send + Sync {
    async fn generate(
        &self,
        input: McpTargetGenerateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<McpTargetGenerateOutput, Box<dyn std::error::Error>>;

    async fn validate(
        &self,
        input: McpTargetValidateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<McpTargetValidateOutput, Box<dyn std::error::Error>>;

    async fn list_tools(
        &self,
        input: McpTargetListToolsInput,
        storage: &dyn ConceptStorage,
    ) -> Result<McpTargetListToolsOutput, Box<dyn std::error::Error>>;

}
