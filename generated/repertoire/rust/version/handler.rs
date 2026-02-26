// generated: version/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait VersionHandler: Send + Sync {
    async fn snapshot(
        &self,
        input: VersionSnapshotInput,
        storage: &dyn ConceptStorage,
    ) -> Result<VersionSnapshotOutput, Box<dyn std::error::Error>>;

    async fn list_versions(
        &self,
        input: VersionListVersionsInput,
        storage: &dyn ConceptStorage,
    ) -> Result<VersionListVersionsOutput, Box<dyn std::error::Error>>;

    async fn rollback(
        &self,
        input: VersionRollbackInput,
        storage: &dyn ConceptStorage,
    ) -> Result<VersionRollbackOutput, Box<dyn std::error::Error>>;

    async fn diff(
        &self,
        input: VersionDiffInput,
        storage: &dyn ConceptStorage,
    ) -> Result<VersionDiffOutput, Box<dyn std::error::Error>>;

}
