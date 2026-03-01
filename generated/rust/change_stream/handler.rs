// generated: change_stream/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait ChangeStreamHandler: Send + Sync {
    async fn append(
        &self,
        input: ChangeStreamAppendInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ChangeStreamAppendOutput, Box<dyn std::error::Error>>;

    async fn subscribe(
        &self,
        input: ChangeStreamSubscribeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ChangeStreamSubscribeOutput, Box<dyn std::error::Error>>;

    async fn read(
        &self,
        input: ChangeStreamReadInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ChangeStreamReadOutput, Box<dyn std::error::Error>>;

    async fn acknowledge(
        &self,
        input: ChangeStreamAcknowledgeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ChangeStreamAcknowledgeOutput, Box<dyn std::error::Error>>;

    async fn replay(
        &self,
        input: ChangeStreamReplayInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ChangeStreamReplayOutput, Box<dyn std::error::Error>>;

}
