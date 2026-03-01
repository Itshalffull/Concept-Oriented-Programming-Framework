// generated: process_run/adapter.rs

use serde_json::Value;
use crate::transport::{
    ActionInvocation, ActionCompletion,
    ConceptTransport, ConceptQuery,
};
use crate::storage::ConceptStorage;
use super::handler::ProcessRunHandler;
use super::types::*;

pub struct ProcessRunAdapter<H: ProcessRunHandler> {
    handler: H,
    storage: Box<dyn ConceptStorage>,
}

impl<H: ProcessRunHandler> ProcessRunAdapter<H> {
    pub fn new(handler: H, storage: Box<dyn ConceptStorage>) -> Self {
        Self { handler, storage }
    }
}

#[async_trait::async_trait]
impl<H: ProcessRunHandler + 'static> ConceptTransport for ProcessRunAdapter<H> {
    async fn invoke(&self, invocation: ActionInvocation) -> Result<ActionCompletion, Box<dyn std::error::Error>> {
        let result: Value = match invocation.action.as_str() {
            "start" => {
                let input: ProcessRunStartInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.start(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "start_child" => {
                let input: ProcessRunStartChildInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.start_child(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "complete" => {
                let input: ProcessRunCompleteInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.complete(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "fail" => {
                let input: ProcessRunFailInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.fail(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "cancel" => {
                let input: ProcessRunCancelInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.cancel(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "suspend" => {
                let input: ProcessRunSuspendInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.suspend(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "resume" => {
                let input: ProcessRunResumeInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.resume(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "get_status" => {
                let input: ProcessRunGetStatusInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.get_status(input, self.storage.as_ref()).await?;
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
