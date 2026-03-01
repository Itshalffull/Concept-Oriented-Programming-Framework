// generated: signal/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait SignalHandler: Send + Sync {
    async fn create(
        &self,
        input: SignalCreateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SignalCreateOutput, Box<dyn std::error::Error>>;

    async fn read(
        &self,
        input: SignalReadInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SignalReadOutput, Box<dyn std::error::Error>>;

    async fn write(
        &self,
        input: SignalWriteInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SignalWriteOutput, Box<dyn std::error::Error>>;

    async fn batch(
        &self,
        input: SignalBatchInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SignalBatchOutput, Box<dyn std::error::Error>>;

    async fn dispose(
        &self,
        input: SignalDisposeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SignalDisposeOutput, Box<dyn std::error::Error>>;

}
