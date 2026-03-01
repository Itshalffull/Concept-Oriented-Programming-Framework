// generated: tree_sitter_sync_spec/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait TreeSitterSyncSpecHandler: Send + Sync {
    async fn initialize(
        &self,
        input: TreeSitterSyncSpecInitializeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TreeSitterSyncSpecInitializeOutput, Box<dyn std::error::Error>>;

}
