// generated: inline_annotation/adapter.rs

use serde_json::Value;
use crate::transport::{
    ActionInvocation, ActionCompletion,
    ConceptTransport, ConceptQuery,
};
use crate::storage::ConceptStorage;
use super::handler::InlineAnnotationHandler;
use super::types::*;

pub struct InlineAnnotationAdapter<H: InlineAnnotationHandler> {
    handler: H,
    storage: Box<dyn ConceptStorage>,
}

impl<H: InlineAnnotationHandler> InlineAnnotationAdapter<H> {
    pub fn new(handler: H, storage: Box<dyn ConceptStorage>) -> Self {
        Self { handler, storage }
    }
}

#[async_trait::async_trait]
impl<H: InlineAnnotationHandler + 'static> ConceptTransport for InlineAnnotationAdapter<H> {
    async fn invoke(&self, invocation: ActionInvocation) -> Result<ActionCompletion, Box<dyn std::error::Error>> {
        let result: Value = match invocation.action.as_str() {
            "annotate" => {
                let input: InlineAnnotationAnnotateInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.annotate(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "accept" => {
                let input: InlineAnnotationAcceptInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.accept(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "reject" => {
                let input: InlineAnnotationRejectInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.reject(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "acceptAll" => {
                let input: InlineAnnotationAcceptAllInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.accept_all(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "rejectAll" => {
                let input: InlineAnnotationRejectAllInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.reject_all(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "toggleTracking" => {
                let input: InlineAnnotationToggleTrackingInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.toggle_tracking(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "listPending" => {
                let input: InlineAnnotationListPendingInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.list_pending(input, self.storage.as_ref()).await?;
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
