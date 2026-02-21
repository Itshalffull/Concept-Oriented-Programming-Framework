// generated: property/adapter.rs

use serde_json::Value;
use crate::transport::{
    ActionInvocation, ActionCompletion,
    ConceptTransport, ConceptQuery,
};
use crate::storage::ConceptStorage;
use super::handler::PropertyHandler;
use super::types::*;

pub struct PropertyAdapter<H: PropertyHandler> {
    handler: H,
    storage: Box<dyn ConceptStorage>,
}

impl<H: PropertyHandler> PropertyAdapter<H> {
    pub fn new(handler: H, storage: Box<dyn ConceptStorage>) -> Self {
        Self { handler, storage }
    }
}

#[async_trait::async_trait]
impl<H: PropertyHandler + 'static> ConceptTransport for PropertyAdapter<H> {
    async fn invoke(&self, invocation: ActionInvocation) -> Result<ActionCompletion, Box<dyn std::error::Error>> {
        let result: Value = match invocation.action.as_str() {
            "set" => {
                let input: PropertySetInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.set(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "get" => {
                let input: PropertyGetInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.get(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "delete" => {
                let input: PropertyDeleteInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.delete(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "defineType" => {
                let input: PropertyDefineTypeInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.define_type(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "listAll" => {
                let input: PropertyListAllInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.list_all(input, self.storage.as_ref()).await?;
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
