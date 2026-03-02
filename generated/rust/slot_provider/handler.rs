// generated: slot_provider/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait SlotProviderHandler: Send + Sync {
    async fn initialize(
        &self,
        input: SlotProviderInitializeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SlotProviderInitializeOutput, Box<dyn std::error::Error>>;

    async fn define(
        &self,
        input: SlotProviderDefineInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SlotProviderDefineOutput, Box<dyn std::error::Error>>;

    async fn fill(
        &self,
        input: SlotProviderFillInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SlotProviderFillOutput, Box<dyn std::error::Error>>;

    async fn clear(
        &self,
        input: SlotProviderClearInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SlotProviderClearOutput, Box<dyn std::error::Error>>;

    async fn get_slots(
        &self,
        input: SlotProviderGetSlotsInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SlotProviderGetSlotsOutput, Box<dyn std::error::Error>>;
}
