// generated: sync_compiler/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait SyncCompilerHandler: Send + Sync {
    async fn compile(
        &self,
        input: SyncCompilerCompileInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SyncCompilerCompileOutput, Box<dyn std::error::Error>>;

}
