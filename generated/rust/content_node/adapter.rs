// generated: content_node/adapter.rs

use serde_json::Value;
use crate::transport::{
    ActionInvocation, ActionCompletion,
    ConceptTransport, ConceptQuery,
};
use crate::storage::ConceptStorage;
use super::handler::ContentNodeHandler;
use super::types::*;

pub struct ContentNodeAdapter<H: ContentNodeHandler> {
    handler: H,
    storage: Box<dyn ConceptStorage>,
}

impl<H: ContentNodeHandler> ContentNodeAdapter<H> {
    pub fn new(handler: H, storage: Box<dyn ConceptStorage>) -> Self {
        Self { handler, storage }
    }
}

#[async_trait::async_trait]
impl<H: ContentNodeHandler + 'static> ConceptTransport for ContentNodeAdapter<H> {
    async fn invoke(&self, invocation: ActionInvocation) -> Result<ActionCompletion, Box<dyn std::error::Error>> {
        let result: Value = match invocation.action.as_str() {
            "create" => {
                let input: ContentNodeCreateInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.create(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "update" => {
                let input: ContentNodeUpdateInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.update(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "delete" => {
                let input: ContentNodeDeleteInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.delete(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "get" => {
                let input: ContentNodeGetInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.get(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "setMetadata" => {
                let input: ContentNodeSetMetadataInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.set_metadata(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "changeType" => {
                let input: ContentNodeChangeTypeInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.change_type(input, self.storage.as_ref()).await?;
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
