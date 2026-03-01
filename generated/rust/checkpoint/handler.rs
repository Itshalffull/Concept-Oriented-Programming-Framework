// generated: checkpoint/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait CheckpointHandler: Send + Sync {
    async fn capture(
        &self,
        input: CheckpointCaptureInput,
        storage: &dyn ConceptStorage,
    ) -> Result<CheckpointCaptureOutput, Box<dyn std::error::Error>>;

    async fn restore(
        &self,
        input: CheckpointRestoreInput,
        storage: &dyn ConceptStorage,
    ) -> Result<CheckpointRestoreOutput, Box<dyn std::error::Error>>;

    async fn find_latest(
        &self,
        input: CheckpointFindLatestInput,
        storage: &dyn ConceptStorage,
    ) -> Result<CheckpointFindLatestOutput, Box<dyn std::error::Error>>;

    async fn prune(
        &self,
        input: CheckpointPruneInput,
        storage: &dyn ConceptStorage,
    ) -> Result<CheckpointPruneOutput, Box<dyn std::error::Error>>;
}
