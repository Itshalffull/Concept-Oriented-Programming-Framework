// generated: timer/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait TimerHandler: Send + Sync {
    async fn set_timer(
        &self,
        input: TimerSetTimerInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TimerSetTimerOutput, Box<dyn std::error::Error>>;

    async fn fire(
        &self,
        input: TimerFireInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TimerFireOutput, Box<dyn std::error::Error>>;

    async fn cancel(
        &self,
        input: TimerCancelInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TimerCancelOutput, Box<dyn std::error::Error>>;

    async fn reset(
        &self,
        input: TimerResetInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TimerResetOutput, Box<dyn std::error::Error>>;
}
