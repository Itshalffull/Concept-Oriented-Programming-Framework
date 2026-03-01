// generated: navigator/adapter.rs

use serde_json::Value;
use crate::transport::{
    ActionInvocation, ActionCompletion,
    ConceptTransport, ConceptQuery,
};
use crate::storage::ConceptStorage;
use super::handler::NavigatorHandler;
use super::types::*;

pub struct NavigatorAdapter<H: NavigatorHandler> {
    handler: H,
    storage: Box<dyn ConceptStorage>,
}

impl<H: NavigatorHandler> NavigatorAdapter<H> {
    pub fn new(handler: H, storage: Box<dyn ConceptStorage>) -> Self {
        Self { handler, storage }
    }
}

#[async_trait::async_trait]
impl<H: NavigatorHandler + 'static> ConceptTransport for NavigatorAdapter<H> {
    async fn invoke(&self, invocation: ActionInvocation) -> Result<ActionCompletion, Box<dyn std::error::Error>> {
        let result: Value = match invocation.action.as_str() {
            "register" => {
                let input: NavigatorRegisterInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.register(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "go" => {
                let input: NavigatorGoInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.go(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "back" => {
                let input: NavigatorBackInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.back(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "forward" => {
                let input: NavigatorForwardInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.forward(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "replace" => {
                let input: NavigatorReplaceInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.replace(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "addGuard" => {
                let input: NavigatorAddGuardInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.add_guard(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "removeGuard" => {
                let input: NavigatorRemoveGuardInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.remove_guard(input, self.storage.as_ref()).await?;
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
