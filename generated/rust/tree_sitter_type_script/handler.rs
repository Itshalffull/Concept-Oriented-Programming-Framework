// generated: tree_sitter_type_script/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait TreeSitterTypeScriptHandler: Send + Sync {
    async fn initialize(
        &self,
        input: TreeSitterTypeScriptInitializeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TreeSitterTypeScriptInitializeOutput, Box<dyn std::error::Error>>;

}
