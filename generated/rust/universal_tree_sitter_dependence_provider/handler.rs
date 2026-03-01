// generated: universal_tree_sitter_dependence_provider/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait UniversalTreeSitterDependenceProviderHandler: Send + Sync {
    async fn initialize(
        &self,
        input: UniversalTreeSitterDependenceProviderInitializeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<UniversalTreeSitterDependenceProviderInitializeOutput, Box<dyn std::error::Error>>;

}
