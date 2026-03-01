// generated: control/adapter.rs

use serde_json::Value;
use crate::transport::{
    ActionInvocation, ActionCompletion,
    ConceptTransport, ConceptQuery,
};
use crate::storage::ConceptStorage;
use super::handler::ControlHandler;
use super::types::*;

pub struct ControlAdapter<H: ControlHandler> {
    handler: H,
    storage: Box<dyn ConceptStorage>,
}

impl<H: ControlHandler> ControlAdapter<H> {
    pub fn new(handler: H, storage: Box<dyn ConceptStorage>) -> Self {
        Self { handler, storage }
    }
}

#[async_trait::async_trait]
impl<H: ControlHandler + 'static> ConceptTransport for ControlAdapter<H> {
    async fn invoke(&self, invocation: ActionInvocation) -> Result<ActionCompletion, Box<dyn std::error::Error>> {
        let result: Value = match invocation.action.as_str() {
            "create" => {
                let input: ControlCreateInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.create(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "interact" => {
                let input: ControlInteractInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.interact(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "getValue" => {
                let input: ControlGetValueInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.get_value(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "setValue" => {
                let input: ControlSetValueInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.set_value(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "triggerAction" => {
                let input: ControlTriggerActionInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.trigger_action(input, self.storage.as_ref()).await?;
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
