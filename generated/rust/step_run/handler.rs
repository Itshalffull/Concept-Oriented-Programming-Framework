// generated: step_run/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait StepRunHandler: Send + Sync {
    async fn start(
        &self,
        input: StepRunStartInput,
        storage: &dyn ConceptStorage,
    ) -> Result<StepRunStartOutput, Box<dyn std::error::Error>>;

    async fn complete(
        &self,
        input: StepRunCompleteInput,
        storage: &dyn ConceptStorage,
    ) -> Result<StepRunCompleteOutput, Box<dyn std::error::Error>>;

    async fn fail(
        &self,
        input: StepRunFailInput,
        storage: &dyn ConceptStorage,
    ) -> Result<StepRunFailOutput, Box<dyn std::error::Error>>;

    async fn cancel(
        &self,
        input: StepRunCancelInput,
        storage: &dyn ConceptStorage,
    ) -> Result<StepRunCancelOutput, Box<dyn std::error::Error>>;

    async fn skip(
        &self,
        input: StepRunSkipInput,
        storage: &dyn ConceptStorage,
    ) -> Result<StepRunSkipOutput, Box<dyn std::error::Error>>;

    async fn get(
        &self,
        input: StepRunGetInput,
        storage: &dyn ConceptStorage,
    ) -> Result<StepRunGetOutput, Box<dyn std::error::Error>>;
}
