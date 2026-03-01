// generated: tree_sitter_concept_spec/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait TreeSitterConceptSpecHandler: Send + Sync {
    async fn initialize(
        &self,
        input: TreeSitterConceptSpecInitializeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TreeSitterConceptSpecInitializeOutput, Box<dyn std::error::Error>>;

}
