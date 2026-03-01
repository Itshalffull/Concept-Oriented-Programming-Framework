// Approval concept transport adapter
// Routes action invocations to the appropriate handler methods.

use serde_json::Value;
use crate::transport::{
    ActionInvocation, ActionCompletion,
    ConceptTransport, ConceptQuery,
};
use crate::storage::ConceptStorage;
use super::handler::ApprovalHandler;
use super::types::*;

pub struct ApprovalAdapter<H: ApprovalHandler> {
    handler: H,
    storage: Box<dyn ConceptStorage>,
}

impl<H: ApprovalHandler> ApprovalAdapter<H> {
    pub fn new(handler: H, storage: Box<dyn ConceptStorage>) -> Self {
        Self { handler, storage }
    }
}

#[async_trait::async_trait]
impl<H: ApprovalHandler + 'static> ConceptTransport for ApprovalAdapter<H> {
    async fn invoke(&self, invocation: ActionInvocation) -> Result<ActionCompletion, Box<dyn std::error::Error>> {
        let result: Value = match invocation.action.as_str() {
            "request" => {
                let input: ApprovalRequestInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.request(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "approve" => {
                let input: ApprovalApproveInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.approve(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "deny" => {
                let input: ApprovalDenyInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.deny(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "request_changes" => {
                let input: ApprovalRequestChangesInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.request_changes(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "timeout" => {
                let input: ApprovalTimeoutInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.timeout(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "get_status" => {
                let input: ApprovalGetStatusInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.get_status(input, self.storage.as_ref()).await?;
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
