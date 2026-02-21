// generated: search_index/adapter.rs

use serde_json::Value;
use crate::transport::{
    ActionInvocation, ActionCompletion,
    ConceptTransport, ConceptQuery,
};
use crate::storage::ConceptStorage;
use super::handler::SearchIndexHandler;
use super::types::*;

pub struct SearchIndexAdapter<H: SearchIndexHandler> {
    handler: H,
    storage: Box<dyn ConceptStorage>,
}

impl<H: SearchIndexHandler> SearchIndexAdapter<H> {
    pub fn new(handler: H, storage: Box<dyn ConceptStorage>) -> Self {
        Self { handler, storage }
    }
}

#[async_trait::async_trait]
impl<H: SearchIndexHandler + 'static> ConceptTransport for SearchIndexAdapter<H> {
    async fn invoke(&self, invocation: ActionInvocation) -> Result<ActionCompletion, Box<dyn std::error::Error>> {
        let result: Value = match invocation.action.as_str() {
            "createIndex" => {
                let input: SearchIndexCreateIndexInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.create_index(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "indexItem" => {
                let input: SearchIndexIndexItemInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.index_item(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "removeItem" => {
                let input: SearchIndexRemoveItemInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.remove_item(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "search" => {
                let input: SearchIndexSearchInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.search(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "addProcessor" => {
                let input: SearchIndexAddProcessorInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.add_processor(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "reindex" => {
                let input: SearchIndexReindexInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.reindex(input, self.storage.as_ref()).await?;
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
