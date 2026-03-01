// WorkItem concept transport adapter
// Routes action invocations to the appropriate handler methods.

use serde_json::Value;
use crate::transport::{
    ActionInvocation, ActionCompletion,
    ConceptTransport, ConceptQuery,
};
use crate::storage::ConceptStorage;
use super::handler::WorkItemHandler;
use super::types::*;

pub struct WorkItemAdapter<H: WorkItemHandler> {
    handler: H,
    storage: Box<dyn ConceptStorage>,
}

impl<H: WorkItemHandler> WorkItemAdapter<H> {
    pub fn new(handler: H, storage: Box<dyn ConceptStorage>) -> Self {
        Self { handler, storage }
    }
}

#[async_trait::async_trait]
impl<H: WorkItemHandler + 'static> ConceptTransport for WorkItemAdapter<H> {
    async fn invoke(&self, invocation: ActionInvocation) -> Result<ActionCompletion, Box<dyn std::error::Error>> {
        let result: Value = match invocation.action.as_str() {
            "create" => {
                let input: WorkItemCreateInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.create(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "claim" => {
                let input: WorkItemClaimInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.claim(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "start" => {
                let input: WorkItemStartInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.start(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "complete" => {
                let input: WorkItemCompleteInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.complete(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "reject" => {
                let input: WorkItemRejectInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.reject(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "delegate" => {
                let input: WorkItemDelegateInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.delegate(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "release" => {
                let input: WorkItemReleaseInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.release(input, self.storage.as_ref()).await?;
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
