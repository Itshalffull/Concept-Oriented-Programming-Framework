// generated: terminal_adapter/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait TerminalAdapterHandler: Send + Sync {
    async fn normalize(
        &self,
        input: TerminalAdapterNormalizeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TerminalAdapterNormalizeOutput, Box<dyn std::error::Error>>;

}
