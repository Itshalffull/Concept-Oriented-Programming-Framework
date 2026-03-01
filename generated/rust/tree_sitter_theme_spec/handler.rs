// generated: tree_sitter_theme_spec/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait TreeSitterThemeSpecHandler: Send + Sync {
    async fn initialize(
        &self,
        input: TreeSitterThemeSpecInitializeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TreeSitterThemeSpecInitializeOutput, Box<dyn std::error::Error>>;

}
