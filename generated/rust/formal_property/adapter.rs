// generated: formal_property/adapter.rs

use serde_json::Value;
use crate::transport::{
    ActionInvocation, ActionCompletion,
    ConceptTransport, ConceptQuery,
};
use crate::storage::ConceptStorage;
use super::handler::FormalPropertyHandler;
use super::types::*;

pub struct FormalPropertyAdapter<H: FormalPropertyHandler> {
    handler: H,
    storage: Box<dyn ConceptStorage>,
}

impl<H: FormalPropertyHandler> FormalPropertyAdapter<H> {
    pub fn new(handler: H, storage: Box<dyn ConceptStorage>) -> Self {
        Self { handler, storage }
    }
}

#[async_trait::async_trait]
impl<H: FormalPropertyHandler + 'static> ConceptTransport for FormalPropertyAdapter<H> {
    async fn invoke(&self, invocation: ActionInvocation) -> Result<ActionCompletion, Box<dyn std::error::Error>> {
        let result: Value = match invocation.action.as_str() {
            "define" => {
                let input: FormalPropertyDefineInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.define(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "prove" => {
                let input: FormalPropertyProveInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.prove(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "refute" => {
                let input: FormalPropertyRefuteInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.refute(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "check" => {
                let input: FormalPropertyCheckInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.check(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "synthesize" => {
                let input: FormalPropertySynthesizeInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.synthesize(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "coverage" => {
                let input: FormalPropertyCoverageInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.coverage(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "list" => {
                let input: FormalPropertyListInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.list(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "invalidate" => {
                let input: FormalPropertyInvalidateInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.invalidate(input, self.storage.as_ref()).await?;
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