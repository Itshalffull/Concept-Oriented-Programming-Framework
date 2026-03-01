// generated: attribution/adapter.rs

use serde_json::Value;
use crate::transport::{
    ActionInvocation, ActionCompletion,
    ConceptTransport, ConceptQuery,
};
use crate::storage::ConceptStorage;
use super::handler::AttributionHandler;
use super::types::*;

pub struct AttributionAdapter<H: AttributionHandler> {
    handler: H,
    storage: Box<dyn ConceptStorage>,
}

impl<H: AttributionHandler> AttributionAdapter<H> {
    pub fn new(handler: H, storage: Box<dyn ConceptStorage>) -> Self {
        Self { handler, storage }
    }
}

#[async_trait::async_trait]
impl<H: AttributionHandler + 'static> ConceptTransport for AttributionAdapter<H> {
    async fn invoke(&self, invocation: ActionInvocation) -> Result<ActionCompletion, Box<dyn std::error::Error>> {
        let result: Value = match invocation.action.as_str() {
            "attribute" => {
                let input: AttributionAttributeInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.attribute(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "blame" => {
                let input: AttributionBlameInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.blame(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "history" => {
                let input: AttributionHistoryInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.history(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "setOwnership" => {
                let input: AttributionSetOwnershipInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.set_ownership(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "queryOwners" => {
                let input: AttributionQueryOwnersInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.query_owners(input, self.storage.as_ref()).await?;
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
