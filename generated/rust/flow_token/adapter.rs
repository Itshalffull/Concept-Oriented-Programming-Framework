// generated: flow_token/adapter.rs

use serde_json::Value;
use crate::transport::{
    ActionInvocation, ActionCompletion,
    ConceptTransport, ConceptQuery,
};
use crate::storage::ConceptStorage;
use super::handler::FlowTokenHandler;
use super::types::*;

pub struct FlowTokenAdapter<H: FlowTokenHandler> {
    handler: H,
    storage: Box<dyn ConceptStorage>,
}

impl<H: FlowTokenHandler> FlowTokenAdapter<H> {
    pub fn new(handler: H, storage: Box<dyn ConceptStorage>) -> Self {
        Self { handler, storage }
    }
}

#[async_trait::async_trait]
impl<H: FlowTokenHandler + 'static> ConceptTransport for FlowTokenAdapter<H> {
    async fn invoke(&self, invocation: ActionInvocation) -> Result<ActionCompletion, Box<dyn std::error::Error>> {
        let result: Value = match invocation.action.as_str() {
            "emit" => {
                let input: FlowTokenEmitInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.emit(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "consume" => {
                let input: FlowTokenConsumeInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.consume(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "kill" => {
                let input: FlowTokenKillInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.kill(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "countActive" => {
                let input: FlowTokenCountActiveInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.count_active(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "listActive" => {
                let input: FlowTokenListActiveInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.list_active(input, self.storage.as_ref()).await?;
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
