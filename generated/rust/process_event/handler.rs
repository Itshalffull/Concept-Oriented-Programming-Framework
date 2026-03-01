// generated: process_event/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait ProcessEventHandler: Send + Sync {
    async fn append(
        &self,
        input: ProcessEventAppendInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ProcessEventAppendOutput, Box<dyn std::error::Error>>;

    async fn query(
        &self,
        input: ProcessEventQueryInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ProcessEventQueryOutput, Box<dyn std::error::Error>>;

    async fn query_by_type(
        &self,
        input: ProcessEventQueryByTypeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ProcessEventQueryByTypeOutput, Box<dyn std::error::Error>>;

    async fn get_cursor(
        &self,
        input: ProcessEventGetCursorInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ProcessEventGetCursorOutput, Box<dyn std::error::Error>>;
}
