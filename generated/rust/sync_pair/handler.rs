// generated: sync_pair/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait SyncPairHandler: Send + Sync {
    async fn link(
        &self,
        input: SyncPairLinkInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SyncPairLinkOutput, Box<dyn std::error::Error>>;

    async fn sync(
        &self,
        input: SyncPairSyncInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SyncPairSyncOutput, Box<dyn std::error::Error>>;

    async fn detect_conflicts(
        &self,
        input: SyncPairDetectConflictsInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SyncPairDetectConflictsOutput, Box<dyn std::error::Error>>;

    async fn resolve(
        &self,
        input: SyncPairResolveInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SyncPairResolveOutput, Box<dyn std::error::Error>>;

    async fn unlink(
        &self,
        input: SyncPairUnlinkInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SyncPairUnlinkOutput, Box<dyn std::error::Error>>;

    async fn get_change_log(
        &self,
        input: SyncPairGetChangeLogInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SyncPairGetChangeLogOutput, Box<dyn std::error::Error>>;

}
