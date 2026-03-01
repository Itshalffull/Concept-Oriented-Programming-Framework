// generated: event_bus/adapter.rs

use serde_json::Value;
use crate::transport::{
    ActionInvocation, ActionCompletion,
    ConceptTransport, ConceptQuery,
};
use crate::storage::ConceptStorage;
use super::handler::EventBusHandler;
use super::types::*;

pub struct EventBusAdapter<H: EventBusHandler> {
    handler: H,
    storage: Box<dyn ConceptStorage>,
}

impl<H: EventBusHandler> EventBusAdapter<H> {
    pub fn new(handler: H, storage: Box<dyn ConceptStorage>) -> Self {
        Self { handler, storage }
    }
}

#[async_trait::async_trait]
impl<H: EventBusHandler + 'static> ConceptTransport for EventBusAdapter<H> {
    async fn invoke(&self, invocation: ActionInvocation) -> Result<ActionCompletion, Box<dyn std::error::Error>> {
        let result: Value = match invocation.action.as_str() {
            "registerEventType" => {
                let input: EventBusRegisterEventTypeInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.register_event_type(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "subscribe" => {
                let input: EventBusSubscribeInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.subscribe(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "unsubscribe" => {
                let input: EventBusUnsubscribeInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.unsubscribe(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "dispatch" => {
                let input: EventBusDispatchInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.dispatch(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "dispatchAsync" => {
                let input: EventBusDispatchAsyncInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.dispatch_async(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "getHistory" => {
                let input: EventBusGetHistoryInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.get_history(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            _ => return Err(format!("Unknown action: {}", invocation.action).into()),
        };

        let variant = result.get("variant")
            .and_then(|v| v.as_str())
            .unwrap_or("ok")
            .to_string();

        Ok(ActionCompletion {
            id: invocation.id,
            concept: invocation.concept,
            action: invocation.action,
            input: invocation.input,
            variant,
            output: result,
            flow: invocation.flow,
            timestamp: chrono::Utc::now().to_rfc3339(),
        })
    }

    async fn query(&self, request: ConceptQuery) -> Result<Vec<Value>, Box<dyn std::error::Error>> {
        self.storage.find(&request.relation, request.args.as_ref()).await
    }

    async fn health(&self) -> Result<(bool, u64), Box<dyn std::error::Error>> {
        Ok((true, 0))
    }
}
