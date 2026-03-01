// generated: transport/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait TransportHandler: Send + Sync {
    async fn configure(
        &self,
        input: TransportConfigureInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TransportConfigureOutput, Box<dyn std::error::Error>>;

    async fn fetch(
        &self,
        input: TransportFetchInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TransportFetchOutput, Box<dyn std::error::Error>>;

    async fn mutate(
        &self,
        input: TransportMutateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TransportMutateOutput, Box<dyn std::error::Error>>;

    async fn flush_queue(
        &self,
        input: TransportFlushQueueInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TransportFlushQueueOutput, Box<dyn std::error::Error>>;

}
