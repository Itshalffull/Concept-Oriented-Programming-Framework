// generated: process_event/adapter.rs

use serde_json::Value;
use crate::transport::{
    ActionInvocation, ActionCompletion,
    ConceptTransport, ConceptQuery,
};
use crate::storage::ConceptStorage;
use super::handler::ProcessEventHandler;
use super::types::*;

pub struct ProcessEventAdapter<H: ProcessEventHandler> {
    handler: H,
    storage: Box<dyn ConceptStorage>,
}

impl<H: ProcessEventHandler> ProcessEventAdapter<H> {
    pub fn new(handler: H, storage: Box<dyn ConceptStorage>) -> Self {
        Self { handler, storage }
    }
}

#[async_trait::async_trait]
impl<H: ProcessEventHandler + 'static> ConceptTransport for ProcessEventAdapter<H> {
    async fn invoke(&self, invocation: ActionInvocation) -> Result<ActionCompletion, Box<dyn std::error::Error>> {
        let result: Value = match invocation.action.as_str() {
            "append" => {
                let input: ProcessEventAppendInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.append(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "query" => {
                let input: ProcessEventQueryInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.query(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "queryByType" => {
                let input: ProcessEventQueryByTypeInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.query_by_type(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "getCursor" => {
                let input: ProcessEventGetCursorInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.get_cursor(input, self.storage.as_ref()).await?;
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
