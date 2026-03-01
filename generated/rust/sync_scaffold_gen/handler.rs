// generated: sync_scaffold_gen/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait SyncScaffoldGenHandler: Send + Sync {
    async fn generate(
        &self,
        input: SyncScaffoldGenGenerateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SyncScaffoldGenGenerateOutput, Box<dyn std::error::Error>>;

    async fn preview(
        &self,
        input: SyncScaffoldGenPreviewInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SyncScaffoldGenPreviewOutput, Box<dyn std::error::Error>>;

    async fn register(
        &self,
        input: SyncScaffoldGenRegisterInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SyncScaffoldGenRegisterOutput, Box<dyn std::error::Error>>;

}
