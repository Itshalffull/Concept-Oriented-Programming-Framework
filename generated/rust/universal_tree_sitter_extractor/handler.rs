// generated: universal_tree_sitter_extractor/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait UniversalTreeSitterExtractorHandler: Send + Sync {
    async fn initialize(
        &self,
        input: UniversalTreeSitterExtractorInitializeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<UniversalTreeSitterExtractorInitializeOutput, Box<dyn std::error::Error>>;

}
