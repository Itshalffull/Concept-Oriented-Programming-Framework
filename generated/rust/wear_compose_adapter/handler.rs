// generated: wear_compose_adapter/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait WearComposeAdapterHandler: Send + Sync {
    async fn normalize(
        &self,
        input: WearComposeAdapterNormalizeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<WearComposeAdapterNormalizeOutput, Box<dyn std::error::Error>>;

}
