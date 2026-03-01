// generated: enrichment_renderer/adapter.rs

use serde_json::Value;
use crate::transport::{
    ActionInvocation, ActionCompletion,
    ConceptTransport, ConceptQuery,
};
use crate::storage::ConceptStorage;
use super::handler::EnrichmentRendererHandler;
use super::types::*;

pub struct EnrichmentRendererAdapter<H: EnrichmentRendererHandler> {
    handler: H,
    storage: Box<dyn ConceptStorage>,
}

impl<H: EnrichmentRendererHandler> EnrichmentRendererAdapter<H> {
    pub fn new(handler: H, storage: Box<dyn ConceptStorage>) -> Self {
        Self { handler, storage }
    }
}

#[async_trait::async_trait]
impl<H: EnrichmentRendererHandler + 'static> ConceptTransport for EnrichmentRendererAdapter<H> {
    async fn invoke(&self, invocation: ActionInvocation) -> Result<ActionCompletion, Box<dyn std::error::Error>> {
        let result: Value = match invocation.action.as_str() {
            "register" => {
                let input: EnrichmentRendererRegisterInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.register(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "render" => {
                let input: EnrichmentRendererRenderInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.render(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "listHandlers" => {
                let input: EnrichmentRendererListHandlersInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.list_handlers(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "listPatterns" => {
                let input: EnrichmentRendererListPatternsInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.list_patterns(input, self.storage.as_ref()).await?;
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
