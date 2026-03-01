// generated: react_adapter/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait ReactAdapterHandler: Send + Sync {
    async fn normalize(
        &self,
        input: ReactAdapterNormalizeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ReactAdapterNormalizeOutput, Box<dyn std::error::Error>>;

}
