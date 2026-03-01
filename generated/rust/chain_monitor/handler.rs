// generated: chain_monitor/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait ChainMonitorHandler: Send + Sync {
    async fn await_finality(
        &self,
        input: ChainMonitorAwaitFinalityInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ChainMonitorAwaitFinalityOutput, Box<dyn std::error::Error>>;

    async fn subscribe(
        &self,
        input: ChainMonitorSubscribeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ChainMonitorSubscribeOutput, Box<dyn std::error::Error>>;

    async fn on_block(
        &self,
        input: ChainMonitorOnBlockInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ChainMonitorOnBlockOutput, Box<dyn std::error::Error>>;

}
