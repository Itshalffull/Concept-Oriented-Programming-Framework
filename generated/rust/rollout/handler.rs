// generated: rollout/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait RolloutHandler: Send + Sync {
    async fn begin(
        &self,
        input: RolloutBeginInput,
        storage: &dyn ConceptStorage,
    ) -> Result<RolloutBeginOutput, Box<dyn std::error::Error>>;

    async fn advance(
        &self,
        input: RolloutAdvanceInput,
        storage: &dyn ConceptStorage,
    ) -> Result<RolloutAdvanceOutput, Box<dyn std::error::Error>>;

    async fn pause(
        &self,
        input: RolloutPauseInput,
        storage: &dyn ConceptStorage,
    ) -> Result<RolloutPauseOutput, Box<dyn std::error::Error>>;

    async fn resume(
        &self,
        input: RolloutResumeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<RolloutResumeOutput, Box<dyn std::error::Error>>;

    async fn abort(
        &self,
        input: RolloutAbortInput,
        storage: &dyn ConceptStorage,
    ) -> Result<RolloutAbortOutput, Box<dyn std::error::Error>>;

    async fn status(
        &self,
        input: RolloutStatusInput,
        storage: &dyn ConceptStorage,
    ) -> Result<RolloutStatusOutput, Box<dyn std::error::Error>>;

}
