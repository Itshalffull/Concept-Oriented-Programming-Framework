// generated: cache/adapter.rs

use serde_json::Value;
use crate::transport::{
    ActionInvocation, ActionCompletion,
    ConceptTransport, ConceptQuery,
};
use crate::storage::ConceptStorage;
use super::handler::CacheHandler;
use super::types::*;

pub struct CacheAdapter<H: CacheHandler> {
    handler: H,
    storage: Box<dyn ConceptStorage>,
}

impl<H: CacheHandler> CacheAdapter<H> {
    pub fn new(handler: H, storage: Box<dyn ConceptStorage>) -> Self {
        Self { handler, storage }
    }
}

#[async_trait::async_trait]
impl<H: CacheHandler + 'static> ConceptTransport for CacheAdapter<H> {
    async fn invoke(&self, invocation: ActionInvocation) -> Result<ActionCompletion, Box<dyn std::error::Error>> {
        let result: Value = match invocation.action.as_str() {
            "set" => {
                let input: CacheSetInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.set(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "get" => {
                let input: CacheGetInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.get(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "invalidate" => {
                let input: CacheInvalidateInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.invalidate(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "invalidateByTags" => {
                let input: CacheInvalidateByTagsInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.invalidate_by_tags(input, self.storage.as_ref()).await?;
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
