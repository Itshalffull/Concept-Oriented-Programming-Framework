// generated: trigram_index_provider/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait TrigramIndexProviderHandler: Send + Sync {
    async fn initialize(
        &self,
        input: TrigramIndexProviderInitializeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TrigramIndexProviderInitializeOutput, Box<dyn std::error::Error>>;

}
