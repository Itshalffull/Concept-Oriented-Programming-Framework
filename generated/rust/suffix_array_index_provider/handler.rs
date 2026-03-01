// generated: suffix_array_index_provider/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait SuffixArrayIndexProviderHandler: Send + Sync {
    async fn initialize(
        &self,
        input: SuffixArrayIndexProviderInitializeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SuffixArrayIndexProviderInitializeOutput, Box<dyn std::error::Error>>;

}
