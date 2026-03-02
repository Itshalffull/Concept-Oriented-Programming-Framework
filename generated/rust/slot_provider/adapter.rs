// generated: slot_provider/adapter.rs

use serde_json::Value;
use crate::transport::{
    ActionInvocation, ActionCompletion,
    ConceptTransport, ConceptQuery,
};
use crate::storage::ConceptStorage;
use super::handler::SlotProviderHandler;
use super::types::*;

pub struct SlotProviderAdapter<H: SlotProviderHandler> {
    handler: H,
    storage: Box<dyn ConceptStorage>,
}

impl<H: SlotProviderHandler> SlotProviderAdapter<H> {
    pub fn new(handler: H, storage: Box<dyn ConceptStorage>) -> Self {
        Self { handler, storage }
    }
}

#[async_trait::async_trait]
impl<H: SlotProviderHandler + 'static> ConceptTransport for SlotProviderAdapter<H> {
    async fn invoke(&self, invocation: ActionInvocation) -> Result<ActionCompletion, Box<dyn std::error::Error>> {
        let result: Value = match invocation.action.as_str() {
            "initialize" => {
                let input: SlotProviderInitializeInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.initialize(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "define" => {
                let input: SlotProviderDefineInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.define(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "fill" => {
                let input: SlotProviderFillInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.fill(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "clear" => {
                let input: SlotProviderClearInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.clear(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "getSlots" => {
                let input: SlotProviderGetSlotsInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.get_slots(input, self.storage.as_ref()).await?;
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
