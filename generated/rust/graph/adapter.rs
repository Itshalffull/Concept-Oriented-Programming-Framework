// generated: graph/adapter.rs

use serde_json::Value;
use crate::transport::{
    ActionInvocation, ActionCompletion,
    ConceptTransport, ConceptQuery,
};
use crate::storage::ConceptStorage;
use super::handler::GraphHandler;
use super::types::*;

pub struct GraphAdapter<H: GraphHandler> {
    handler: H,
    storage: Box<dyn ConceptStorage>,
}

impl<H: GraphHandler> GraphAdapter<H> {
    pub fn new(handler: H, storage: Box<dyn ConceptStorage>) -> Self {
        Self { handler, storage }
    }
}

#[async_trait::async_trait]
impl<H: GraphHandler + 'static> ConceptTransport for GraphAdapter<H> {
    async fn invoke(&self, invocation: ActionInvocation) -> Result<ActionCompletion, Box<dyn std::error::Error>> {
        let result: Value = match invocation.action.as_str() {
            "addNode" => {
                let input: GraphAddNodeInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.add_node(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "removeNode" => {
                let input: GraphRemoveNodeInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.remove_node(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "addEdge" => {
                let input: GraphAddEdgeInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.add_edge(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "removeEdge" => {
                let input: GraphRemoveEdgeInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.remove_edge(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "getNeighbors" => {
                let input: GraphGetNeighborsInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.get_neighbors(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "filterNodes" => {
                let input: GraphFilterNodesInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.filter_nodes(input, self.storage.as_ref()).await?;
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
