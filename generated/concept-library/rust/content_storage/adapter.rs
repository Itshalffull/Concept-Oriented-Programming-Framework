// generated: content_storage/adapter.rs

use serde_json::Value;
use crate::transport::{
    ActionInvocation, ActionCompletion,
    ConceptTransport, ConceptQuery,
};
use crate::storage::ConceptStorage;
use super::handler::ContentStorageHandler;
use super::types::*;

pub struct ContentStorageAdapter<H: ContentStorageHandler> {
    handler: H,
    storage: Box<dyn ConceptStorage>,
}

impl<H: ContentStorageHandler> ContentStorageAdapter<H> {
    pub fn new(handler: H, storage: Box<dyn ConceptStorage>) -> Self {
        Self { handler, storage }
    }
}

#[async_trait::async_trait]
impl<H: ContentStorageHandler + 'static> ConceptTransport for ContentStorageAdapter<H> {
    async fn invoke(&self, invocation: ActionInvocation) -> Result<ActionCompletion, Box<dyn std::error::Error>> {
        let result: Value = match invocation.action.as_str() {
            "save" => {
                let input: ContentStorageSaveInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.save(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "load" => {
                let input: ContentStorageLoadInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.load(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "delete" => {
                let input: ContentStorageDeleteInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.delete(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "query" => {
                let input: ContentStorageQueryInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.query(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "generateSchema" => {
                let input: ContentStorageGenerateSchemaInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.generate_schema(input, self.storage.as_ref()).await?;
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
