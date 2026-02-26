// generated: workflow/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait WorkflowHandler: Send + Sync {
    async fn define_state(
        &self,
        input: WorkflowDefineStateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<WorkflowDefineStateOutput, Box<dyn std::error::Error>>;

    async fn define_transition(
        &self,
        input: WorkflowDefineTransitionInput,
        storage: &dyn ConceptStorage,
    ) -> Result<WorkflowDefineTransitionOutput, Box<dyn std::error::Error>>;

    async fn transition(
        &self,
        input: WorkflowTransitionInput,
        storage: &dyn ConceptStorage,
    ) -> Result<WorkflowTransitionOutput, Box<dyn std::error::Error>>;

    async fn get_current_state(
        &self,
        input: WorkflowGetCurrentStateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<WorkflowGetCurrentStateOutput, Box<dyn std::error::Error>>;

}
