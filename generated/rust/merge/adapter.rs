// generated: merge/adapter.rs

use serde_json::Value;
use crate::transport::{
    ActionInvocation, ActionCompletion,
    ConceptTransport, ConceptQuery,
};
use crate::storage::ConceptStorage;
use super::handler::MergeHandler;
use super::types::*;

pub struct MergeAdapter<H: MergeHandler> {
    handler: H,
    storage: Box<dyn ConceptStorage>,
}

impl<H: MergeHandler> MergeAdapter<H> {
    pub fn new(handler: H, storage: Box<dyn ConceptStorage>) -> Self {
        Self { handler, storage }
    }
}

#[async_trait::async_trait]
impl<H: MergeHandler + 'static> ConceptTransport for MergeAdapter<H> {
    async fn invoke(&self, invocation: ActionInvocation) -> Result<ActionCompletion, Box<dyn std::error::Error>> {
        let result: Value = match invocation.action.as_str() {
            "registerStrategy" => {
                let input: MergeRegisterStrategyInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.register_strategy(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "merge" => {
                let input: MergeMergeInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.merge(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "resolveConflict" => {
                let input: MergeResolveConflictInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.resolve_conflict(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "finalize" => {
                let input: MergeFinalizeInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.finalize(input, self.storage.as_ref()).await?;
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
