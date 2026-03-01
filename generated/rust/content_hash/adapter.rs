// generated: content_hash/adapter.rs

use serde_json::Value;
use crate::transport::{
    ActionInvocation, ActionCompletion,
    ConceptTransport, ConceptQuery,
};
use crate::storage::ConceptStorage;
use super::handler::ContentHashHandler;
use super::types::*;

pub struct ContentHashAdapter<H: ContentHashHandler> {
    handler: H,
    storage: Box<dyn ConceptStorage>,
}

impl<H: ContentHashHandler> ContentHashAdapter<H> {
    pub fn new(handler: H, storage: Box<dyn ConceptStorage>) -> Self {
        Self { handler, storage }
    }
}

#[async_trait::async_trait]
impl<H: ContentHashHandler + 'static> ConceptTransport for ContentHashAdapter<H> {
    async fn invoke(&self, invocation: ActionInvocation) -> Result<ActionCompletion, Box<dyn std::error::Error>> {
        let result: Value = match invocation.action.as_str() {
            "store" => {
                let input: ContentHashStoreInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.store(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "retrieve" => {
                let input: ContentHashRetrieveInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.retrieve(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "verify" => {
                let input: ContentHashVerifyInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.verify(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "delete" => {
                let input: ContentHashDeleteInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.delete(input, self.storage.as_ref()).await?;
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
