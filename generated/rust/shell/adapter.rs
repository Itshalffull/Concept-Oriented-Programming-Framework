// generated: shell/adapter.rs

use serde_json::Value;
use crate::transport::{
    ActionInvocation, ActionCompletion,
    ConceptTransport, ConceptQuery,
};
use crate::storage::ConceptStorage;
use super::handler::ShellHandler;
use super::types::*;

pub struct ShellAdapter<H: ShellHandler> {
    handler: H,
    storage: Box<dyn ConceptStorage>,
}

impl<H: ShellHandler> ShellAdapter<H> {
    pub fn new(handler: H, storage: Box<dyn ConceptStorage>) -> Self {
        Self { handler, storage }
    }
}

#[async_trait::async_trait]
impl<H: ShellHandler + 'static> ConceptTransport for ShellAdapter<H> {
    async fn invoke(&self, invocation: ActionInvocation) -> Result<ActionCompletion, Box<dyn std::error::Error>> {
        let result: Value = match invocation.action.as_str() {
            "initialize" => {
                let input: ShellInitializeInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.initialize(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "assignToZone" => {
                let input: ShellAssignToZoneInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.assign_to_zone(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "clearZone" => {
                let input: ShellClearZoneInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.clear_zone(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "pushOverlay" => {
                let input: ShellPushOverlayInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.push_overlay(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "popOverlay" => {
                let input: ShellPopOverlayInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.pop_overlay(input, self.storage.as_ref()).await?;
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
