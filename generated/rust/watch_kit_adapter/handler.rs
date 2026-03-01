// generated: watch_kit_adapter/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait WatchKitAdapterHandler: Send + Sync {
    async fn normalize(
        &self,
        input: WatchKitAdapterNormalizeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<WatchKitAdapterNormalizeOutput, Box<dyn std::error::Error>>;

}
