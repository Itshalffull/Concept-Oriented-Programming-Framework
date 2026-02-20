// generated: sync_engine/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait SyncEngineHandler: Send + Sync {
    async fn register_sync(
        &self,
        input: SyncEngineRegisterSyncInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SyncEngineRegisterSyncOutput, Box<dyn std::error::Error>>;

    async fn on_completion(
        &self,
        input: SyncEngineOnCompletionInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SyncEngineOnCompletionOutput, Box<dyn std::error::Error>>;

    async fn evaluate_where(
        &self,
        input: SyncEngineEvaluateWhereInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SyncEngineEvaluateWhereOutput, Box<dyn std::error::Error>>;

    async fn queue_sync(
        &self,
        input: SyncEngineQueueSyncInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SyncEngineQueueSyncOutput, Box<dyn std::error::Error>>;

    async fn on_availability_change(
        &self,
        input: SyncEngineOnAvailabilityChangeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SyncEngineOnAvailabilityChangeOutput, Box<dyn std::error::Error>>;

    async fn drain_conflicts(
        &self,
        input: SyncEngineDrainConflictsInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SyncEngineDrainConflictsOutput, Box<dyn std::error::Error>>;

}
