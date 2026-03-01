// generated: d_a_g_history/adapter.rs

use serde_json::Value;
use crate::transport::{
    ActionInvocation, ActionCompletion,
    ConceptTransport, ConceptQuery,
};
use crate::storage::ConceptStorage;
use super::handler::DAGHistoryHandler;
use super::types::*;

pub struct DAGHistoryAdapter<H: DAGHistoryHandler> {
    handler: H,
    storage: Box<dyn ConceptStorage>,
}

impl<H: DAGHistoryHandler> DAGHistoryAdapter<H> {
    pub fn new(handler: H, storage: Box<dyn ConceptStorage>) -> Self {
        Self { handler, storage }
    }
}

#[async_trait::async_trait]
impl<H: DAGHistoryHandler + 'static> ConceptTransport for DAGHistoryAdapter<H> {
    async fn invoke(&self, invocation: ActionInvocation) -> Result<ActionCompletion, Box<dyn std::error::Error>> {
        let result: Value = match invocation.action.as_str() {
            "append" => {
                let input: DAGHistoryAppendInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.append(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "ancestors" => {
                let input: DAGHistoryAncestorsInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.ancestors(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "commonAncestor" => {
                let input: DAGHistoryCommonAncestorInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.common_ancestor(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "descendants" => {
                let input: DAGHistoryDescendantsInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.descendants(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "between" => {
                let input: DAGHistoryBetweenInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.between(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "getNode" => {
                let input: DAGHistoryGetNodeInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.get_node(input, self.storage.as_ref()).await?;
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
