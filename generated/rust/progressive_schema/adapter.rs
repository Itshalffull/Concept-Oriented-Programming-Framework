// generated: progressive_schema/adapter.rs

use serde_json::Value;
use crate::transport::{
    ActionInvocation, ActionCompletion,
    ConceptTransport, ConceptQuery,
};
use crate::storage::ConceptStorage;
use super::handler::ProgressiveSchemaHandler;
use super::types::*;

pub struct ProgressiveSchemaAdapter<H: ProgressiveSchemaHandler> {
    handler: H,
    storage: Box<dyn ConceptStorage>,
}

impl<H: ProgressiveSchemaHandler> ProgressiveSchemaAdapter<H> {
    pub fn new(handler: H, storage: Box<dyn ConceptStorage>) -> Self {
        Self { handler, storage }
    }
}

#[async_trait::async_trait]
impl<H: ProgressiveSchemaHandler + 'static> ConceptTransport for ProgressiveSchemaAdapter<H> {
    async fn invoke(&self, invocation: ActionInvocation) -> Result<ActionCompletion, Box<dyn std::error::Error>> {
        let result: Value = match invocation.action.as_str() {
            "captureFreeform" => {
                let input: ProgressiveSchemaCaptureFreeformInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.capture_freeform(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "detectStructure" => {
                let input: ProgressiveSchemaDetectStructureInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.detect_structure(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "acceptSuggestion" => {
                let input: ProgressiveSchemaAcceptSuggestionInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.accept_suggestion(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "rejectSuggestion" => {
                let input: ProgressiveSchemaRejectSuggestionInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.reject_suggestion(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "promote" => {
                let input: ProgressiveSchemaPromoteInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.promote(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "inferSchema" => {
                let input: ProgressiveSchemaInferSchemaInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.infer_schema(input, self.storage.as_ref()).await?;
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
