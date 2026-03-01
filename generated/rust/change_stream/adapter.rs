// generated: change_stream/adapter.rs

use serde_json::Value;
use crate::transport::{
    ActionInvocation, ActionCompletion,
    ConceptTransport, ConceptQuery,
};
use crate::storage::ConceptStorage;
use super::handler::ChangeStreamHandler;
use super::types::*;

pub struct ChangeStreamAdapter<H: ChangeStreamHandler> {
    handler: H,
    storage: Box<dyn ConceptStorage>,
}

impl<H: ChangeStreamHandler> ChangeStreamAdapter<H> {
    pub fn new(handler: H, storage: Box<dyn ConceptStorage>) -> Self {
        Self { handler, storage }
    }
}

#[async_trait::async_trait]
impl<H: ChangeStreamHandler + 'static> ConceptTransport for ChangeStreamAdapter<H> {
    async fn invoke(&self, invocation: ActionInvocation) -> Result<ActionCompletion, Box<dyn std::error::Error>> {
        let result: Value = match invocation.action.as_str() {
            "append" => {
                let input: ChangeStreamAppendInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.append(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "subscribe" => {
                let input: ChangeStreamSubscribeInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.subscribe(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "read" => {
                let input: ChangeStreamReadInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.read(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "acknowledge" => {
                let input: ChangeStreamAcknowledgeInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.acknowledge(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "replay" => {
                let input: ChangeStreamReplayInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.replay(input, self.storage.as_ref()).await?;
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
