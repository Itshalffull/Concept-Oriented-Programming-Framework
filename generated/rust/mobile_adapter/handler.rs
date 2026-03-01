// generated: mobile_adapter/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait MobileAdapterHandler: Send + Sync {
    async fn normalize(
        &self,
        input: MobileAdapterNormalizeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<MobileAdapterNormalizeOutput, Box<dyn std::error::Error>>;

}
