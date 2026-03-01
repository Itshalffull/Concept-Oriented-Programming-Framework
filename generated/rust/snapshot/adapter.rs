// generated: snapshot/adapter.rs

use serde_json::Value;
use crate::transport::{
    ActionInvocation, ActionCompletion,
    ConceptTransport, ConceptQuery,
};
use crate::storage::ConceptStorage;
use super::handler::SnapshotHandler;
use super::types::*;

pub struct SnapshotAdapter<H: SnapshotHandler> {
    handler: H,
    storage: Box<dyn ConceptStorage>,
}

impl<H: SnapshotHandler> SnapshotAdapter<H> {
    pub fn new(handler: H, storage: Box<dyn ConceptStorage>) -> Self {
        Self { handler, storage }
    }
}

#[async_trait::async_trait]
impl<H: SnapshotHandler + 'static> ConceptTransport for SnapshotAdapter<H> {
    async fn invoke(&self, invocation: ActionInvocation) -> Result<ActionCompletion, Box<dyn std::error::Error>> {
        let result: Value = match invocation.action.as_str() {
            "compare" => {
                let input: SnapshotCompareInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.compare(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "approve" => {
                let input: SnapshotApproveInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.approve(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "approveAll" => {
                let input: SnapshotApproveAllInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.approve_all(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "reject" => {
                let input: SnapshotRejectInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.reject(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "status" => {
                let input: SnapshotStatusInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.status(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "diff" => {
                let input: SnapshotDiffInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.diff(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "clean" => {
                let input: SnapshotCleanInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.clean(input, self.storage.as_ref()).await?;
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
