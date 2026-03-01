// generated: provenance/adapter.rs

use serde_json::Value;
use crate::transport::{
    ActionInvocation, ActionCompletion,
    ConceptTransport, ConceptQuery,
};
use crate::storage::ConceptStorage;
use super::handler::ProvenanceHandler;
use super::types::*;

pub struct ProvenanceAdapter<H: ProvenanceHandler> {
    handler: H,
    storage: Box<dyn ConceptStorage>,
}

impl<H: ProvenanceHandler> ProvenanceAdapter<H> {
    pub fn new(handler: H, storage: Box<dyn ConceptStorage>) -> Self {
        Self { handler, storage }
    }
}

#[async_trait::async_trait]
impl<H: ProvenanceHandler + 'static> ConceptTransport for ProvenanceAdapter<H> {
    async fn invoke(&self, invocation: ActionInvocation) -> Result<ActionCompletion, Box<dyn std::error::Error>> {
        let result: Value = match invocation.action.as_str() {
            "record" => {
                let input: ProvenanceRecordInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.record(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "trace" => {
                let input: ProvenanceTraceInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.trace(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "audit" => {
                let input: ProvenanceAuditInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.audit(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "rollback" => {
                let input: ProvenanceRollbackInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.rollback(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "diff" => {
                let input: ProvenanceDiffInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.diff(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "reproduce" => {
                let input: ProvenanceReproduceInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.reproduce(input, self.storage.as_ref()).await?;
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
