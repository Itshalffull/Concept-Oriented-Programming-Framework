// generated: synced_content/adapter.rs

use serde_json::Value;
use crate::transport::{
    ActionInvocation, ActionCompletion,
    ConceptTransport, ConceptQuery,
};
use crate::storage::ConceptStorage;
use super::handler::SyncedContentHandler;
use super::types::*;

pub struct SyncedContentAdapter<H: SyncedContentHandler> {
    handler: H,
    storage: Box<dyn ConceptStorage>,
}

impl<H: SyncedContentHandler> SyncedContentAdapter<H> {
    pub fn new(handler: H, storage: Box<dyn ConceptStorage>) -> Self {
        Self { handler, storage }
    }
}

#[async_trait::async_trait]
impl<H: SyncedContentHandler + 'static> ConceptTransport for SyncedContentAdapter<H> {
    async fn invoke(&self, invocation: ActionInvocation) -> Result<ActionCompletion, Box<dyn std::error::Error>> {
        let result: Value = match invocation.action.as_str() {
            "createReference" => {
                let input: SyncedContentCreateReferenceInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.create_reference(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "editOriginal" => {
                let input: SyncedContentEditOriginalInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.edit_original(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "deleteReference" => {
                let input: SyncedContentDeleteReferenceInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.delete_reference(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "convertToIndependent" => {
                let input: SyncedContentConvertToIndependentInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.convert_to_independent(input, self.storage.as_ref()).await?;
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
