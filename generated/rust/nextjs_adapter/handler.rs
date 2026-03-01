// generated: nextjs_adapter/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait NextjsAdapterHandler: Send + Sync {
    async fn normalize(
        &self,
        input: NextjsAdapterNormalizeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<NextjsAdapterNormalizeOutput, Box<dyn std::error::Error>>;

}
