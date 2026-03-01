// generated: generation_plan/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait GenerationPlanHandler: Send + Sync {
    async fn begin(
        &self,
        input: GenerationPlanBeginInput,
        storage: &dyn ConceptStorage,
    ) -> Result<GenerationPlanBeginOutput, Box<dyn std::error::Error>>;

    async fn record_step(
        &self,
        input: GenerationPlanRecordStepInput,
        storage: &dyn ConceptStorage,
    ) -> Result<GenerationPlanRecordStepOutput, Box<dyn std::error::Error>>;

    async fn complete(
        &self,
        input: GenerationPlanCompleteInput,
        storage: &dyn ConceptStorage,
    ) -> Result<GenerationPlanCompleteOutput, Box<dyn std::error::Error>>;

    async fn status(
        &self,
        input: GenerationPlanStatusInput,
        storage: &dyn ConceptStorage,
    ) -> Result<GenerationPlanStatusOutput, Box<dyn std::error::Error>>;

    async fn summary(
        &self,
        input: GenerationPlanSummaryInput,
        storage: &dyn ConceptStorage,
    ) -> Result<GenerationPlanSummaryOutput, Box<dyn std::error::Error>>;

    async fn history(
        &self,
        input: GenerationPlanHistoryInput,
        storage: &dyn ConceptStorage,
    ) -> Result<GenerationPlanHistoryOutput, Box<dyn std::error::Error>>;

}
