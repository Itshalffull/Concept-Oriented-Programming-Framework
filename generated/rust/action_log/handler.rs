// generated: action_log/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait ActionLogHandler: Send + Sync {
    async fn append(
        &self,
        input: ActionLogAppendInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ActionLogAppendOutput, Box<dyn std::error::Error>>;

    async fn add_edge(
        &self,
        input: ActionLogAddEdgeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ActionLogAddEdgeOutput, Box<dyn std::error::Error>>;

    async fn query(
        &self,
        input: ActionLogQueryInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ActionLogQueryOutput, Box<dyn std::error::Error>>;

}
