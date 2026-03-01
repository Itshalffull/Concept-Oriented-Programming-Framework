// generated: snapshot/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait SnapshotHandler: Send + Sync {
    async fn compare(
        &self,
        input: SnapshotCompareInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SnapshotCompareOutput, Box<dyn std::error::Error>>;

    async fn approve(
        &self,
        input: SnapshotApproveInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SnapshotApproveOutput, Box<dyn std::error::Error>>;

    async fn approve_all(
        &self,
        input: SnapshotApproveAllInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SnapshotApproveAllOutput, Box<dyn std::error::Error>>;

    async fn reject(
        &self,
        input: SnapshotRejectInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SnapshotRejectOutput, Box<dyn std::error::Error>>;

    async fn status(
        &self,
        input: SnapshotStatusInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SnapshotStatusOutput, Box<dyn std::error::Error>>;

    async fn diff(
        &self,
        input: SnapshotDiffInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SnapshotDiffOutput, Box<dyn std::error::Error>>;

    async fn clean(
        &self,
        input: SnapshotCleanInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SnapshotCleanOutput, Box<dyn std::error::Error>>;

}
