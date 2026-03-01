// generated: win_u_i_adapter/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait WinUIAdapterHandler: Send + Sync {
    async fn normalize(
        &self,
        input: WinUIAdapterNormalizeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<WinUIAdapterNormalizeOutput, Box<dyn std::error::Error>>;

}
