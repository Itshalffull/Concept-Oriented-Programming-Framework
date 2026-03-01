// generated: widget_state_entity/adapter.rs

use serde_json::Value;
use crate::transport::{
    ActionInvocation, ActionCompletion,
    ConceptTransport, ConceptQuery,
};
use crate::storage::ConceptStorage;
use super::handler::WidgetStateEntityHandler;
use super::types::*;

pub struct WidgetStateEntityAdapter<H: WidgetStateEntityHandler> {
    handler: H,
    storage: Box<dyn ConceptStorage>,
}

impl<H: WidgetStateEntityHandler> WidgetStateEntityAdapter<H> {
    pub fn new(handler: H, storage: Box<dyn ConceptStorage>) -> Self {
        Self { handler, storage }
    }
}

#[async_trait::async_trait]
impl<H: WidgetStateEntityHandler + 'static> ConceptTransport for WidgetStateEntityAdapter<H> {
    async fn invoke(&self, invocation: ActionInvocation) -> Result<ActionCompletion, Box<dyn std::error::Error>> {
        let result: Value = match invocation.action.as_str() {
            "register" => {
                let input: WidgetStateEntityRegisterInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.register(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "findByWidget" => {
                let input: WidgetStateEntityFindByWidgetInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.find_by_widget(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "reachableFrom" => {
                let input: WidgetStateEntityReachableFromInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.reachable_from(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "unreachableStates" => {
                let input: WidgetStateEntityUnreachableStatesInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.unreachable_states(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "traceEvent" => {
                let input: WidgetStateEntityTraceEventInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.trace_event(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "get" => {
                let input: WidgetStateEntityGetInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.get(input, self.storage.as_ref()).await?;
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
