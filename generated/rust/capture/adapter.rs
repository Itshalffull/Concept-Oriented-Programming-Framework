// generated: capture/adapter.rs

use serde_json::Value;
use crate::transport::{
    ActionInvocation, ActionCompletion,
    ConceptTransport, ConceptQuery,
};
use crate::storage::ConceptStorage;
use super::handler::CaptureHandler;
use super::types::*;

pub struct CaptureAdapter<H: CaptureHandler> {
    handler: H,
    storage: Box<dyn ConceptStorage>,
}

impl<H: CaptureHandler> CaptureAdapter<H> {
    pub fn new(handler: H, storage: Box<dyn ConceptStorage>) -> Self {
        Self { handler, storage }
    }
}

#[async_trait::async_trait]
impl<H: CaptureHandler + 'static> ConceptTransport for CaptureAdapter<H> {
    async fn invoke(&self, invocation: ActionInvocation) -> Result<ActionCompletion, Box<dyn std::error::Error>> {
        let result: Value = match invocation.action.as_str() {
            "clip" => {
                let input: CaptureClipInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.clip(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "import" => {
                let input: CaptureImportInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.import(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "subscribe" => {
                let input: CaptureSubscribeInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.subscribe(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "detectChanges" => {
                let input: CaptureDetectChangesInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.detect_changes(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "markReady" => {
                let input: CaptureMarkReadyInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.mark_ready(input, self.storage.as_ref()).await?;
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
