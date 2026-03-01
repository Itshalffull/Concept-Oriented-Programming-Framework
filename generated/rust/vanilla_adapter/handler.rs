// generated: vanilla_adapter/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait VanillaAdapterHandler: Send + Sync {
    async fn normalize(
        &self,
        input: VanillaAdapterNormalizeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<VanillaAdapterNormalizeOutput, Box<dyn std::error::Error>>;

}
