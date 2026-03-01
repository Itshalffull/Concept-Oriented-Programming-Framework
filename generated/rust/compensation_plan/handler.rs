// generated: compensation_plan/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait CompensationPlanHandler: Send + Sync {
    async fn register(
        &self,
        input: CompensationPlanRegisterInput,
        storage: &dyn ConceptStorage,
    ) -> Result<CompensationPlanRegisterOutput, Box<dyn std::error::Error>>;

    async fn trigger(
        &self,
        input: CompensationPlanTriggerInput,
        storage: &dyn ConceptStorage,
    ) -> Result<CompensationPlanTriggerOutput, Box<dyn std::error::Error>>;

    async fn execute_next(
        &self,
        input: CompensationPlanExecuteNextInput,
        storage: &dyn ConceptStorage,
    ) -> Result<CompensationPlanExecuteNextOutput, Box<dyn std::error::Error>>;

    async fn mark_compensation_failed(
        &self,
        input: CompensationPlanMarkFailedInput,
        storage: &dyn ConceptStorage,
    ) -> Result<CompensationPlanMarkFailedOutput, Box<dyn std::error::Error>>;
}
