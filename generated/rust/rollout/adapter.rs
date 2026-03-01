// generated: rollout/adapter.rs

use serde_json::Value;
use crate::transport::{
    ActionInvocation, ActionCompletion,
    ConceptTransport, ConceptQuery,
};
use crate::storage::ConceptStorage;
use super::handler::RolloutHandler;
use super::types::*;

pub struct RolloutAdapter<H: RolloutHandler> {
    handler: H,
    storage: Box<dyn ConceptStorage>,
}

impl<H: RolloutHandler> RolloutAdapter<H> {
    pub fn new(handler: H, storage: Box<dyn ConceptStorage>) -> Self {
        Self { handler, storage }
    }
}

#[async_trait::async_trait]
impl<H: RolloutHandler + 'static> ConceptTransport for RolloutAdapter<H> {
    async fn invoke(&self, invocation: ActionInvocation) -> Result<ActionCompletion, Box<dyn std::error::Error>> {
        let result: Value = match invocation.action.as_str() {
            "begin" => {
                let input: RolloutBeginInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.begin(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "advance" => {
                let input: RolloutAdvanceInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.advance(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "pause" => {
                let input: RolloutPauseInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.pause(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "resume" => {
                let input: RolloutResumeInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.resume(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "abort" => {
                let input: RolloutAbortInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.abort(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "status" => {
                let input: RolloutStatusInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.status(input, self.storage.as_ref()).await?;
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
