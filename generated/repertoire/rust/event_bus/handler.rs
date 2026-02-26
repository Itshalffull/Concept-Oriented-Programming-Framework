// generated: event_bus/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait EventBusHandler: Send + Sync {
    async fn register_event_type(
        &self,
        input: EventBusRegisterEventTypeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<EventBusRegisterEventTypeOutput, Box<dyn std::error::Error>>;

    async fn subscribe(
        &self,
        input: EventBusSubscribeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<EventBusSubscribeOutput, Box<dyn std::error::Error>>;

    async fn unsubscribe(
        &self,
        input: EventBusUnsubscribeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<EventBusUnsubscribeOutput, Box<dyn std::error::Error>>;

    async fn dispatch(
        &self,
        input: EventBusDispatchInput,
        storage: &dyn ConceptStorage,
    ) -> Result<EventBusDispatchOutput, Box<dyn std::error::Error>>;

    async fn dispatch_async(
        &self,
        input: EventBusDispatchAsyncInput,
        storage: &dyn ConceptStorage,
    ) -> Result<EventBusDispatchAsyncOutput, Box<dyn std::error::Error>>;

    async fn get_history(
        &self,
        input: EventBusGetHistoryInput,
        storage: &dyn ConceptStorage,
    ) -> Result<EventBusGetHistoryOutput, Box<dyn std::error::Error>>;

}
