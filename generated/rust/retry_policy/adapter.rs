// generated: retry_policy/adapter.rs

use serde_json::Value;
use crate::transport::{
    ActionInvocation, ActionCompletion,
    ConceptTransport, ConceptQuery,
};
use crate::storage::ConceptStorage;
use super::handler::RetryPolicyHandler;
use super::types::*;

pub struct RetryPolicyAdapter<H: RetryPolicyHandler> {
    handler: H,
    storage: Box<dyn ConceptStorage>,
}

impl<H: RetryPolicyHandler> RetryPolicyAdapter<H> {
    pub fn new(handler: H, storage: Box<dyn ConceptStorage>) -> Self {
        Self { handler, storage }
    }
}

#[async_trait::async_trait]
impl<H: RetryPolicyHandler + 'static> ConceptTransport for RetryPolicyAdapter<H> {
    async fn invoke(&self, invocation: ActionInvocation) -> Result<ActionCompletion, Box<dyn std::error::Error>> {
        let result: Value = match invocation.action.as_str() {
            "create" => {
                let input: RetryPolicyCreateInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.create(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "should_retry" => {
                let input: RetryPolicyShouldRetryInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.should_retry(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "record_attempt" => {
                let input: RetryPolicyRecordAttemptInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.record_attempt(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "mark_succeeded" => {
                let input: RetryPolicyMarkSucceededInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.mark_succeeded(input, self.storage.as_ref()).await?;
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
