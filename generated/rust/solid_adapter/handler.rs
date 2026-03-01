// generated: solid_adapter/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait SolidAdapterHandler: Send + Sync {
    async fn normalize(
        &self,
        input: SolidAdapterNormalizeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SolidAdapterNormalizeOutput, Box<dyn std::error::Error>>;

}
