// generated: config_sync/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait ConfigSyncHandler: Send + Sync {
    async fn export(
        &self,
        input: ConfigSyncExportInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ConfigSyncExportOutput, Box<dyn std::error::Error>>;

    async fn import(
        &self,
        input: ConfigSyncImportInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ConfigSyncImportOutput, Box<dyn std::error::Error>>;

    async fn override(
        &self,
        input: ConfigSyncOverrideInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ConfigSyncOverrideOutput, Box<dyn std::error::Error>>;

    async fn diff(
        &self,
        input: ConfigSyncDiffInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ConfigSyncDiffOutput, Box<dyn std::error::Error>>;

}
