// generated: svelte_adapter/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait SvelteAdapterHandler: Send + Sync {
    async fn normalize(
        &self,
        input: SvelteAdapterNormalizeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SvelteAdapterNormalizeOutput, Box<dyn std::error::Error>>;

}
