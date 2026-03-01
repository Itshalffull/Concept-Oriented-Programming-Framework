// generated: g_t_k_adapter/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait GTKAdapterHandler: Send + Sync {
    async fn normalize(
        &self,
        input: GTKAdapterNormalizeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<GTKAdapterNormalizeOutput, Box<dyn std::error::Error>>;

}
