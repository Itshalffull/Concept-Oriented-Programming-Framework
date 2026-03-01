// generated: branch/adapter.rs

use serde_json::Value;
use crate::transport::{
    ActionInvocation, ActionCompletion,
    ConceptTransport, ConceptQuery,
};
use crate::storage::ConceptStorage;
use super::handler::BranchHandler;
use super::types::*;

pub struct BranchAdapter<H: BranchHandler> {
    handler: H,
    storage: Box<dyn ConceptStorage>,
}

impl<H: BranchHandler> BranchAdapter<H> {
    pub fn new(handler: H, storage: Box<dyn ConceptStorage>) -> Self {
        Self { handler, storage }
    }
}

#[async_trait::async_trait]
impl<H: BranchHandler + 'static> ConceptTransport for BranchAdapter<H> {
    async fn invoke(&self, invocation: ActionInvocation) -> Result<ActionCompletion, Box<dyn std::error::Error>> {
        let result: Value = match invocation.action.as_str() {
            "create" => {
                let input: BranchCreateInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.create(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "advance" => {
                let input: BranchAdvanceInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.advance(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "delete" => {
                let input: BranchDeleteInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.delete(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "protect" => {
                let input: BranchProtectInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.protect(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "setUpstream" => {
                let input: BranchSetUpstreamInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.set_upstream(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "divergencePoint" => {
                let input: BranchDivergencePointInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.divergence_point(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "archive" => {
                let input: BranchArchiveInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.archive(input, self.storage.as_ref()).await?;
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
