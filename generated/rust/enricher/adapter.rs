// generated: enricher/adapter.rs

use serde_json::Value;
use crate::transport::{
    ActionInvocation, ActionCompletion,
    ConceptTransport, ConceptQuery,
};
use crate::storage::ConceptStorage;
use super::handler::EnricherHandler;
use super::types::*;

pub struct EnricherAdapter<H: EnricherHandler> {
    handler: H,
    storage: Box<dyn ConceptStorage>,
}

impl<H: EnricherHandler> EnricherAdapter<H> {
    pub fn new(handler: H, storage: Box<dyn ConceptStorage>) -> Self {
        Self { handler, storage }
    }
}

#[async_trait::async_trait]
impl<H: EnricherHandler + 'static> ConceptTransport for EnricherAdapter<H> {
    async fn invoke(&self, invocation: ActionInvocation) -> Result<ActionCompletion, Box<dyn std::error::Error>> {
        let result: Value = match invocation.action.as_str() {
            "enrich" => {
                let input: EnricherEnrichInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.enrich(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "suggest" => {
                let input: EnricherSuggestInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.suggest(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "accept" => {
                let input: EnricherAcceptInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.accept(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "reject" => {
                let input: EnricherRejectInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.reject(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "refreshStale" => {
                let input: EnricherRefreshStaleInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.refresh_stale(input, self.storage.as_ref()).await?;
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
