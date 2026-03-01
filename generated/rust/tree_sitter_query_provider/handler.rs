// generated: tree_sitter_query_provider/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait TreeSitterQueryProviderHandler: Send + Sync {
    async fn initialize(
        &self,
        input: TreeSitterQueryProviderInitializeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TreeSitterQueryProviderInitializeOutput, Box<dyn std::error::Error>>;

    async fn execute(
        &self,
        input: TreeSitterQueryProviderExecuteInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TreeSitterQueryProviderExecuteOutput, Box<dyn std::error::Error>>;

}
