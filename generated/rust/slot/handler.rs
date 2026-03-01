// generated: slot/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait SlotHandler: Send + Sync {
    async fn define(
        &self,
        input: SlotDefineInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SlotDefineOutput, Box<dyn std::error::Error>>;

    async fn fill(
        &self,
        input: SlotFillInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SlotFillOutput, Box<dyn std::error::Error>>;

    async fn clear(
        &self,
        input: SlotClearInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SlotClearOutput, Box<dyn std::error::Error>>;

}
