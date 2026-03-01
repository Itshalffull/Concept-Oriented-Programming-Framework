// generated: checkpoint/adapter.rs

use serde_json::Value;
use crate::transport::{
    ActionInvocation, ActionCompletion,
    ConceptTransport, ConceptQuery,
};
use crate::storage::ConceptStorage;
use super::handler::CheckpointHandler;
use super::types::*;

pub struct CheckpointAdapter<H: CheckpointHandler> {
    handler: H,
    storage: Box<dyn ConceptStorage>,
}

impl<H: CheckpointHandler> CheckpointAdapter<H> {
    pub fn new(handler: H, storage: Box<dyn ConceptStorage>) -> Self {
        Self { handler, storage }
    }
}

#[async_trait::async_trait]
impl<H: CheckpointHandler + 'static> ConceptTransport for CheckpointAdapter<H> {
    async fn invoke(&self, invocation: ActionInvocation) -> Result<ActionCompletion, Box<dyn std::error::Error>> {
        let result: Value = match invocation.action.as_str() {
            "capture" => {
                let input: CheckpointCaptureInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.capture(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "restore" => {
                let input: CheckpointRestoreInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.restore(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "find_latest" => {
                let input: CheckpointFindLatestInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.find_latest(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "prune" => {
                let input: CheckpointPruneInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.prune(input, self.storage.as_ref()).await?;
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
