// generated: sync_scope_provider/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait SyncScopeProviderHandler: Send + Sync {
    async fn initialize(
        &self,
        input: SyncScopeProviderInitializeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SyncScopeProviderInitializeOutput, Box<dyn std::error::Error>>;

}
