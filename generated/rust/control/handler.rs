// generated: control/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait ControlHandler: Send + Sync {
    async fn create(
        &self,
        input: ControlCreateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ControlCreateOutput, Box<dyn std::error::Error>>;

    async fn interact(
        &self,
        input: ControlInteractInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ControlInteractOutput, Box<dyn std::error::Error>>;

    async fn get_value(
        &self,
        input: ControlGetValueInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ControlGetValueOutput, Box<dyn std::error::Error>>;

    async fn set_value(
        &self,
        input: ControlSetValueInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ControlSetValueOutput, Box<dyn std::error::Error>>;

    async fn trigger_action(
        &self,
        input: ControlTriggerActionInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ControlTriggerActionOutput, Box<dyn std::error::Error>>;

}
