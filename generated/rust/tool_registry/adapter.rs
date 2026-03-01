// generated: tool_registry/adapter.rs

use serde_json::Value;
use crate::transport::{
    ActionInvocation, ActionCompletion,
    ConceptTransport, ConceptQuery,
};
use crate::storage::ConceptStorage;
use super::handler::ToolRegistryHandler;
use super::types::*;

pub struct ToolRegistryAdapter<H: ToolRegistryHandler> {
    handler: H,
    storage: Box<dyn ConceptStorage>,
}

impl<H: ToolRegistryHandler> ToolRegistryAdapter<H> {
    pub fn new(handler: H, storage: Box<dyn ConceptStorage>) -> Self {
        Self { handler, storage }
    }
}

#[async_trait::async_trait]
impl<H: ToolRegistryHandler + 'static> ConceptTransport for ToolRegistryAdapter<H> {
    async fn invoke(&self, invocation: ActionInvocation) -> Result<ActionCompletion, Box<dyn std::error::Error>> {
        let result: Value = match invocation.action.as_str() {
            "register" => {
                let input: ToolRegistryRegisterInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.register(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "deprecate" => {
                let input: ToolRegistryDeprecateInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.deprecate(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "disable" => {
                let input: ToolRegistryDisableInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.disable(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "authorize" => {
                let input: ToolRegistryAuthorizeInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.authorize(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "check_access" => {
                let input: ToolRegistryCheckAccessInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.check_access(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "list_active" => {
                let input: ToolRegistryListActiveInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.list_active(input, self.storage.as_ref()).await?;
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
