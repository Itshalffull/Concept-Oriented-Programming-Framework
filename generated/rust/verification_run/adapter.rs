// generated: verification_run/adapter.rs

use serde_json::Value;
use crate::transport::{
    ActionInvocation, ActionCompletion,
    ConceptTransport, ConceptQuery,
};
use crate::storage::ConceptStorage;
use super::handler::VerificationRunHandler;
use super::types::*;

pub struct VerificationRunAdapter<H: VerificationRunHandler> {
    handler: H,
    storage: Box<dyn ConceptStorage>,
}

impl<H: VerificationRunHandler> VerificationRunAdapter<H> {
    pub fn new(handler: H, storage: Box<dyn ConceptStorage>) -> Self {
        Self { handler, storage }
    }
}

#[async_trait::async_trait]
impl<H: VerificationRunHandler + 'static> ConceptTransport for VerificationRunAdapter<H> {
    async fn invoke(&self, invocation: ActionInvocation) -> Result<ActionCompletion, Box<dyn std::error::Error>> {
        let result: Value = match invocation.action.as_str() {
            "start" => {
                let input: VerificationRunStartInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.start(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "complete" => {
                let input: VerificationRunCompleteInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.complete(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "timeout" => {
                let input: VerificationRunTimeoutInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.timeout(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "cancel" => {
                let input: VerificationRunCancelInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.cancel(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "get_status" => {
                let input: VerificationRunGet_statusInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.get_status(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "compare" => {
                let input: VerificationRunCompareInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.compare(input, self.storage.as_ref()).await?;
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