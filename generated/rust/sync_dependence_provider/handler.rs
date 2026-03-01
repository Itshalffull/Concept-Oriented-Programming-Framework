// generated: sync_dependence_provider/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait SyncDependenceProviderHandler: Send + Sync {
    async fn initialize(
        &self,
        input: SyncDependenceProviderInitializeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SyncDependenceProviderInitializeOutput, Box<dyn std::error::Error>>;

}
