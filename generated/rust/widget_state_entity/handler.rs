// generated: widget_state_entity/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait WidgetStateEntityHandler: Send + Sync {
    async fn register(
        &self,
        input: WidgetStateEntityRegisterInput,
        storage: &dyn ConceptStorage,
    ) -> Result<WidgetStateEntityRegisterOutput, Box<dyn std::error::Error>>;

    async fn find_by_widget(
        &self,
        input: WidgetStateEntityFindByWidgetInput,
        storage: &dyn ConceptStorage,
    ) -> Result<WidgetStateEntityFindByWidgetOutput, Box<dyn std::error::Error>>;

    async fn reachable_from(
        &self,
        input: WidgetStateEntityReachableFromInput,
        storage: &dyn ConceptStorage,
    ) -> Result<WidgetStateEntityReachableFromOutput, Box<dyn std::error::Error>>;

    async fn unreachable_states(
        &self,
        input: WidgetStateEntityUnreachableStatesInput,
        storage: &dyn ConceptStorage,
    ) -> Result<WidgetStateEntityUnreachableStatesOutput, Box<dyn std::error::Error>>;

    async fn trace_event(
        &self,
        input: WidgetStateEntityTraceEventInput,
        storage: &dyn ConceptStorage,
    ) -> Result<WidgetStateEntityTraceEventOutput, Box<dyn std::error::Error>>;

    async fn get(
        &self,
        input: WidgetStateEntityGetInput,
        storage: &dyn ConceptStorage,
    ) -> Result<WidgetStateEntityGetOutput, Box<dyn std::error::Error>>;

}
