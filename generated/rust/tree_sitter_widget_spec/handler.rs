// generated: tree_sitter_widget_spec/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait TreeSitterWidgetSpecHandler: Send + Sync {
    async fn initialize(
        &self,
        input: TreeSitterWidgetSpecInitializeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TreeSitterWidgetSpecInitializeOutput, Box<dyn std::error::Error>>;

}
