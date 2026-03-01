// generated: flaky_test/adapter.rs

use serde_json::Value;
use crate::transport::{
    ActionInvocation, ActionCompletion,
    ConceptTransport, ConceptQuery,
};
use crate::storage::ConceptStorage;
use super::handler::FlakyTestHandler;
use super::types::*;

pub struct FlakyTestAdapter<H: FlakyTestHandler> {
    handler: H,
    storage: Box<dyn ConceptStorage>,
}

impl<H: FlakyTestHandler> FlakyTestAdapter<H> {
    pub fn new(handler: H, storage: Box<dyn ConceptStorage>) -> Self {
        Self { handler, storage }
    }
}

#[async_trait::async_trait]
impl<H: FlakyTestHandler + 'static> ConceptTransport for FlakyTestAdapter<H> {
    async fn invoke(&self, invocation: ActionInvocation) -> Result<ActionCompletion, Box<dyn std::error::Error>> {
        let result: Value = match invocation.action.as_str() {
            "record" => {
                let input: FlakyTestRecordInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.record(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "quarantine" => {
                let input: FlakyTestQuarantineInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.quarantine(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "release" => {
                let input: FlakyTestReleaseInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.release(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "isQuarantined" => {
                let input: FlakyTestIsQuarantinedInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.is_quarantined(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "report" => {
                let input: FlakyTestReportInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.report(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "setPolicy" => {
                let input: FlakyTestSetPolicyInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.set_policy(input, self.storage.as_ref()).await?;
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
