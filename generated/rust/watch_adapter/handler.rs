// generated: watch_adapter/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait WatchAdapterHandler: Send + Sync {
    async fn normalize(
        &self,
        input: WatchAdapterNormalizeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<WatchAdapterNormalizeOutput, Box<dyn std::error::Error>>;

}
