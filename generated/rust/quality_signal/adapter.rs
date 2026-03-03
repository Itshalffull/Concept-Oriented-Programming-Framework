// generated: quality_signal/adapter.rs

use serde_json::Value;
use crate::transport::{
    ActionInvocation, ActionCompletion,
    ConceptTransport, ConceptQuery,
};
use crate::storage::ConceptStorage;
use super::handler::QualitySignalHandler;
use super::types::*;

pub struct QualitySignalAdapter<H: QualitySignalHandler> {
    handler: H,
    storage: Box<dyn ConceptStorage>,
}

impl<H: QualitySignalHandler> QualitySignalAdapter<H> {
    pub fn new(handler: H, storage: Box<dyn ConceptStorage>) -> Self {
        Self { handler, storage }
    }
}

#[async_trait::async_trait]
impl<H: QualitySignalHandler + 'static> ConceptTransport for QualitySignalAdapter<H> {
    async fn invoke(&self, invocation: ActionInvocation) -> Result<ActionCompletion, Box<dyn std::error::Error>> {
        let result: Value = match invocation.action.as_str() {
            "record" => {
                let input: QualitySignalRecordInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.record(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "latest" => {
                let input: QualitySignalLatestInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.latest(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "rollup" => {
                let input: QualitySignalRollupInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.rollup(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "explain" => {
                let input: QualitySignalExplainInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.explain(input, self.storage.as_ref()).await?;
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