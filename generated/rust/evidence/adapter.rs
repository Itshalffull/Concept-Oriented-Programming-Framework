// generated: evidence/adapter.rs

use serde_json::Value;
use crate::transport::{
    ActionInvocation, ActionCompletion,
    ConceptTransport, ConceptQuery,
};
use crate::storage::ConceptStorage;
use super::handler::EvidenceHandler;
use super::types::*;

pub struct EvidenceAdapter<H: EvidenceHandler> {
    handler: H,
    storage: Box<dyn ConceptStorage>,
}

impl<H: EvidenceHandler> EvidenceAdapter<H> {
    pub fn new(handler: H, storage: Box<dyn ConceptStorage>) -> Self {
        Self { handler, storage }
    }
}

#[async_trait::async_trait]
impl<H: EvidenceHandler + 'static> ConceptTransport for EvidenceAdapter<H> {
    async fn invoke(&self, invocation: ActionInvocation) -> Result<ActionCompletion, Box<dyn std::error::Error>> {
        let result: Value = match invocation.action.as_str() {
            "record" => {
                let input: EvidenceRecordInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.record(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "validate" => {
                let input: EvidenceValidateInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.validate(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "retrieve" => {
                let input: EvidenceRetrieveInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.retrieve(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "compare" => {
                let input: EvidenceCompareInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.compare(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "minimize" => {
                let input: EvidenceMinimizeInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.minimize(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "list" => {
                let input: EvidenceListInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.list(input, self.storage.as_ref()).await?;
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