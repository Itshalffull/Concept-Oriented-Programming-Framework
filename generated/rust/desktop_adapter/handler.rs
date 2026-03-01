// generated: desktop_adapter/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait DesktopAdapterHandler: Send + Sync {
    async fn normalize(
        &self,
        input: DesktopAdapterNormalizeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DesktopAdapterNormalizeOutput, Box<dyn std::error::Error>>;

}
