// generated: display_mode/adapter.rs

use serde_json::Value;
use crate::transport::{
    ActionInvocation, ActionCompletion,
    ConceptTransport, ConceptQuery,
};
use crate::storage::ConceptStorage;
use super::handler::DisplayModeHandler;
use super::types::*;

pub struct DisplayModeAdapter<H: DisplayModeHandler> {
    handler: H,
    storage: Box<dyn ConceptStorage>,
}

impl<H: DisplayModeHandler> DisplayModeAdapter<H> {
    pub fn new(handler: H, storage: Box<dyn ConceptStorage>) -> Self {
        Self { handler, storage }
    }
}

#[async_trait::async_trait]
impl<H: DisplayModeHandler + 'static> ConceptTransport for DisplayModeAdapter<H> {
    async fn invoke(&self, invocation: ActionInvocation) -> Result<ActionCompletion, Box<dyn std::error::Error>> {
        let result: Value = match invocation.action.as_str() {
            "defineMode" => {
                let input: DisplayModeDefineModeInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.define_mode(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "configureFieldDisplay" => {
                let input: DisplayModeConfigureFieldDisplayInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.configure_field_display(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "configureFieldForm" => {
                let input: DisplayModeConfigureFieldFormInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.configure_field_form(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "renderInMode" => {
                let input: DisplayModeRenderInModeInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.render_in_mode(input, self.storage.as_ref()).await?;
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
