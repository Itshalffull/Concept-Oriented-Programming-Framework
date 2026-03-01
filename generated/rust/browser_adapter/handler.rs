// generated: browser_adapter/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait BrowserAdapterHandler: Send + Sync {
    async fn normalize(
        &self,
        input: BrowserAdapterNormalizeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<BrowserAdapterNormalizeOutput, Box<dyn std::error::Error>>;

}
