// generated: ink_adapter/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait InkAdapterHandler: Send + Sync {
    async fn normalize(
        &self,
        input: InkAdapterNormalizeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<InkAdapterNormalizeOutput, Box<dyn std::error::Error>>;

}
