// generated: transport/adapter.rs

use serde_json::Value;
use crate::transport::{
    ActionInvocation, ActionCompletion,
    ConceptTransport, ConceptQuery,
};
use crate::storage::ConceptStorage;
use super::handler::TransportHandler;
use super::types::*;

pub struct TransportAdapter<H: TransportHandler> {
    handler: H,
    storage: Box<dyn ConceptStorage>,
}

impl<H: TransportHandler> TransportAdapter<H> {
    pub fn new(handler: H, storage: Box<dyn ConceptStorage>) -> Self {
        Self { handler, storage }
    }
}

#[async_trait::async_trait]
impl<H: TransportHandler + 'static> ConceptTransport for TransportAdapter<H> {
    async fn invoke(&self, invocation: ActionInvocation) -> Result<ActionCompletion, Box<dyn std::error::Error>> {
        let result: Value = match invocation.action.as_str() {
            "configure" => {
                let input: TransportConfigureInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.configure(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "fetch" => {
                let input: TransportFetchInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.fetch(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "mutate" => {
                let input: TransportMutateInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.mutate(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "flushQueue" => {
                let input: TransportFlushQueueInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.flush_queue(input, self.storage.as_ref()).await?;
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
