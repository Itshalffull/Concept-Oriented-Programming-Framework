// generated: kind_system/adapter.rs

use serde_json::Value;
use crate::transport::{
    ActionInvocation, ActionCompletion,
    ConceptTransport, ConceptQuery,
};
use crate::storage::ConceptStorage;
use super::handler::KindSystemHandler;
use super::types::*;

pub struct KindSystemAdapter<H: KindSystemHandler> {
    handler: H,
    storage: Box<dyn ConceptStorage>,
}

impl<H: KindSystemHandler> KindSystemAdapter<H> {
    pub fn new(handler: H, storage: Box<dyn ConceptStorage>) -> Self {
        Self { handler, storage }
    }
}

#[async_trait::async_trait]
impl<H: KindSystemHandler + 'static> ConceptTransport for KindSystemAdapter<H> {
    async fn invoke(&self, invocation: ActionInvocation) -> Result<ActionCompletion, Box<dyn std::error::Error>> {
        let result: Value = match invocation.action.as_str() {
            "define" => {
                let input: KindSystemDefineInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.define(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "connect" => {
                let input: KindSystemConnectInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.connect(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "route" => {
                let input: KindSystemRouteInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.route(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "validate" => {
                let input: KindSystemValidateInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.validate(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "dependents" => {
                let input: KindSystemDependentsInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.dependents(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "producers" => {
                let input: KindSystemProducersInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.producers(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "consumers" => {
                let input: KindSystemConsumersInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.consumers(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "graph" => {
                let input: KindSystemGraphInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.graph(input, self.storage.as_ref()).await?;
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
