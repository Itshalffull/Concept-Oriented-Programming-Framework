// generated: signal/adapter.rs

use serde_json::Value;
use crate::transport::{
    ActionInvocation, ActionCompletion,
    ConceptTransport, ConceptQuery,
};
use crate::storage::ConceptStorage;
use super::handler::SignalHandler;
use super::types::*;

pub struct SignalAdapter<H: SignalHandler> {
    handler: H,
    storage: Box<dyn ConceptStorage>,
}

impl<H: SignalHandler> SignalAdapter<H> {
    pub fn new(handler: H, storage: Box<dyn ConceptStorage>) -> Self {
        Self { handler, storage }
    }
}

#[async_trait::async_trait]
impl<H: SignalHandler + 'static> ConceptTransport for SignalAdapter<H> {
    async fn invoke(&self, invocation: ActionInvocation) -> Result<ActionCompletion, Box<dyn std::error::Error>> {
        let result: Value = match invocation.action.as_str() {
            "create" => {
                let input: SignalCreateInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.create(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "read" => {
                let input: SignalReadInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.read(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "write" => {
                let input: SignalWriteInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.write(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "batch" => {
                let input: SignalBatchInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.batch(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "dispose" => {
                let input: SignalDisposeInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.dispose(input, self.storage.as_ref()).await?;
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
