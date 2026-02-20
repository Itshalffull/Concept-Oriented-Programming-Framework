// generated: echo/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait EchoHandler: Send + Sync {
    async fn send(
        &self,
        input: EchoSendInput,
        storage: &dyn ConceptStorage,
    ) -> Result<EchoSendOutput, Box<dyn std::error::Error>>;

}
