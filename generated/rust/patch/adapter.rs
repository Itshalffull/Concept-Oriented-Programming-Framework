// generated: patch/adapter.rs

use serde_json::Value;
use crate::transport::{
    ActionInvocation, ActionCompletion,
    ConceptTransport, ConceptQuery,
};
use crate::storage::ConceptStorage;
use super::handler::PatchHandler;
use super::types::*;

pub struct PatchAdapter<H: PatchHandler> {
    handler: H,
    storage: Box<dyn ConceptStorage>,
}

impl<H: PatchHandler> PatchAdapter<H> {
    pub fn new(handler: H, storage: Box<dyn ConceptStorage>) -> Self {
        Self { handler, storage }
    }
}

#[async_trait::async_trait]
impl<H: PatchHandler + 'static> ConceptTransport for PatchAdapter<H> {
    async fn invoke(&self, invocation: ActionInvocation) -> Result<ActionCompletion, Box<dyn std::error::Error>> {
        let result: Value = match invocation.action.as_str() {
            "create" => {
                let input: PatchCreateInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.create(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "apply" => {
                let input: PatchApplyInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.apply(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "invert" => {
                let input: PatchInvertInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.invert(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "compose" => {
                let input: PatchComposeInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.compose(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "commute" => {
                let input: PatchCommuteInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.commute(input, self.storage.as_ref()).await?;
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
