// generated: vue_adapter/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait VueAdapterHandler: Send + Sync {
    async fn normalize(
        &self,
        input: VueAdapterNormalizeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<VueAdapterNormalizeOutput, Box<dyn std::error::Error>>;

}
