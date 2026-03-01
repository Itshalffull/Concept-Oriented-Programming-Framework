// generated: step_run/adapter.rs

use serde_json::Value;
use crate::transport::{
    ActionInvocation, ActionCompletion,
    ConceptTransport, ConceptQuery,
};
use crate::storage::ConceptStorage;
use super::handler::StepRunHandler;
use super::types::*;

pub struct StepRunAdapter<H: StepRunHandler> {
    handler: H,
    storage: Box<dyn ConceptStorage>,
}

impl<H: StepRunHandler> StepRunAdapter<H> {
    pub fn new(handler: H, storage: Box<dyn ConceptStorage>) -> Self {
        Self { handler, storage }
    }
}

#[async_trait::async_trait]
impl<H: StepRunHandler + 'static> ConceptTransport for StepRunAdapter<H> {
    async fn invoke(&self, invocation: ActionInvocation) -> Result<ActionCompletion, Box<dyn std::error::Error>> {
        let result: Value = match invocation.action.as_str() {
            "start" => {
                let input: StepRunStartInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.start(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "complete" => {
                let input: StepRunCompleteInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.complete(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "fail" => {
                let input: StepRunFailInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.fail(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "cancel" => {
                let input: StepRunCancelInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.cancel(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "skip" => {
                let input: StepRunSkipInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.skip(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "get" => {
                let input: StepRunGetInput = serde_json::from_value(invocation.input.clone())?;
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
