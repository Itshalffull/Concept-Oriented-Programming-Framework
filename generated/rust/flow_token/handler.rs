// generated: flow_token/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait FlowTokenHandler: Send + Sync {
    async fn emit(
        &self,
        input: FlowTokenEmitInput,
        storage: &dyn ConceptStorage,
    ) -> Result<FlowTokenEmitOutput, Box<dyn std::error::Error>>;

    async fn consume(
        &self,
        input: FlowTokenConsumeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<FlowTokenConsumeOutput, Box<dyn std::error::Error>>;

    async fn kill(
        &self,
        input: FlowTokenKillInput,
        storage: &dyn ConceptStorage,
    ) -> Result<FlowTokenKillOutput, Box<dyn std::error::Error>>;

    async fn count_active(
        &self,
        input: FlowTokenCountActiveInput,
        storage: &dyn ConceptStorage,
    ) -> Result<FlowTokenCountActiveOutput, Box<dyn std::error::Error>>;

    async fn list_active(
        &self,
        input: FlowTokenListActiveInput,
        storage: &dyn ConceptStorage,
    ) -> Result<FlowTokenListActiveOutput, Box<dyn std::error::Error>>;
}
