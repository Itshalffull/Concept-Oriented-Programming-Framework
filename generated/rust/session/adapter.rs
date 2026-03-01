// generated: session/adapter.rs

use serde_json::Value;
use crate::transport::{
    ActionInvocation, ActionCompletion,
    ConceptTransport, ConceptQuery,
};
use crate::storage::ConceptStorage;
use super::handler::SessionHandler;
use super::types::*;

pub struct SessionAdapter<H: SessionHandler> {
    handler: H,
    storage: Box<dyn ConceptStorage>,
}

impl<H: SessionHandler> SessionAdapter<H> {
    pub fn new(handler: H, storage: Box<dyn ConceptStorage>) -> Self {
        Self { handler, storage }
    }
}

#[async_trait::async_trait]
impl<H: SessionHandler + 'static> ConceptTransport for SessionAdapter<H> {
    async fn invoke(&self, invocation: ActionInvocation) -> Result<ActionCompletion, Box<dyn std::error::Error>> {
        let result: Value = match invocation.action.as_str() {
            "create" => {
                let input: SessionCreateInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.create(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "validate" => {
                let input: SessionValidateInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.validate(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "refresh" => {
                let input: SessionRefreshInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.refresh(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "destroy" => {
                let input: SessionDestroyInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.destroy(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "destroyAll" => {
                let input: SessionDestroyAllInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.destroy_all(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "getContext" => {
                let input: SessionGetContextInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.get_context(input, self.storage.as_ref()).await?;
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
