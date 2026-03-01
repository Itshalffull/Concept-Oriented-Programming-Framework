// generated: app_kit_adapter/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait AppKitAdapterHandler: Send + Sync {
    async fn normalize(
        &self,
        input: AppKitAdapterNormalizeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<AppKitAdapterNormalizeOutput, Box<dyn std::error::Error>>;

}
