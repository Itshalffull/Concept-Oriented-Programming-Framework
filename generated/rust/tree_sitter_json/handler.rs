// generated: tree_sitter_json/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait TreeSitterJsonHandler: Send + Sync {
    async fn initialize(
        &self,
        input: TreeSitterJsonInitializeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TreeSitterJsonInitializeOutput, Box<dyn std::error::Error>>;

}
