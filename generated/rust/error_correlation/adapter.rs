// generated: error_correlation/adapter.rs

use serde_json::Value;
use crate::transport::{
    ActionInvocation, ActionCompletion,
    ConceptTransport, ConceptQuery,
};
use crate::storage::ConceptStorage;
use super::handler::ErrorCorrelationHandler;
use super::types::*;

pub struct ErrorCorrelationAdapter<H: ErrorCorrelationHandler> {
    handler: H,
    storage: Box<dyn ConceptStorage>,
}

impl<H: ErrorCorrelationHandler> ErrorCorrelationAdapter<H> {
    pub fn new(handler: H, storage: Box<dyn ConceptStorage>) -> Self {
        Self { handler, storage }
    }
}

#[async_trait::async_trait]
impl<H: ErrorCorrelationHandler + 'static> ConceptTransport for ErrorCorrelationAdapter<H> {
    async fn invoke(&self, invocation: ActionInvocation) -> Result<ActionCompletion, Box<dyn std::error::Error>> {
        let result: Value = match invocation.action.as_str() {
            "record" => {
                let input: ErrorCorrelationRecordInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.record(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "findByEntity" => {
                let input: ErrorCorrelationFindByEntityInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.find_by_entity(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "findByKind" => {
                let input: ErrorCorrelationFindByKindInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.find_by_kind(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "errorHotspots" => {
                let input: ErrorCorrelationErrorHotspotsInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.error_hotspots(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "rootCause" => {
                let input: ErrorCorrelationRootCauseInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.root_cause(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "get" => {
                let input: ErrorCorrelationGetInput = serde_json::from_value(invocation.input.clone())?;
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
