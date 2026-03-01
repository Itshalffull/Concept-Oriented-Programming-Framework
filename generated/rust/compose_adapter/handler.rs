// generated: compose_adapter/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait ComposeAdapterHandler: Send + Sync {
    async fn normalize(
        &self,
        input: ComposeAdapterNormalizeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ComposeAdapterNormalizeOutput, Box<dyn std::error::Error>>;

}
