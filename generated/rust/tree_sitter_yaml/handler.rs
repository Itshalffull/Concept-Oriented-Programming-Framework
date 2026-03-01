// generated: tree_sitter_yaml/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait TreeSitterYamlHandler: Send + Sync {
    async fn initialize(
        &self,
        input: TreeSitterYamlInitializeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TreeSitterYamlInitializeOutput, Box<dyn std::error::Error>>;

}
