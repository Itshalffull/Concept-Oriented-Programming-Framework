// generated: outline/adapter.rs

use serde_json::Value;
use crate::transport::{
    ActionInvocation, ActionCompletion,
    ConceptTransport, ConceptQuery,
};
use crate::storage::ConceptStorage;
use super::handler::OutlineHandler;
use super::types::*;

pub struct OutlineAdapter<H: OutlineHandler> {
    handler: H,
    storage: Box<dyn ConceptStorage>,
}

impl<H: OutlineHandler> OutlineAdapter<H> {
    pub fn new(handler: H, storage: Box<dyn ConceptStorage>) -> Self {
        Self { handler, storage }
    }
}

#[async_trait::async_trait]
impl<H: OutlineHandler + 'static> ConceptTransport for OutlineAdapter<H> {
    async fn invoke(&self, invocation: ActionInvocation) -> Result<ActionCompletion, Box<dyn std::error::Error>> {
        let result: Value = match invocation.action.as_str() {
            "create" => {
                let input: OutlineCreateInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.create(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "indent" => {
                let input: OutlineIndentInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.indent(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "outdent" => {
                let input: OutlineOutdentInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.outdent(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "moveUp" => {
                let input: OutlineMoveUpInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.move_up(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "moveDown" => {
                let input: OutlineMoveDownInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.move_down(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "collapse" => {
                let input: OutlineCollapseInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.collapse(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "expand" => {
                let input: OutlineExpandInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.expand(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "reparent" => {
                let input: OutlineReparentInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.reparent(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "getChildren" => {
                let input: OutlineGetChildrenInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.get_children(input, self.storage.as_ref()).await?;
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
