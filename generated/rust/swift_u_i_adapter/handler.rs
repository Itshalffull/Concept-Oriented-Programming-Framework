// generated: swift_u_i_adapter/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait SwiftUIAdapterHandler: Send + Sync {
    async fn normalize(
        &self,
        input: SwiftUIAdapterNormalizeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SwiftUIAdapterNormalizeOutput, Box<dyn std::error::Error>>;

}
