// generated: dependence_graph/adapter.rs

use serde_json::Value;
use crate::transport::{
    ActionInvocation, ActionCompletion,
    ConceptTransport, ConceptQuery,
};
use crate::storage::ConceptStorage;
use super::handler::DependenceGraphHandler;
use super::types::*;

pub struct DependenceGraphAdapter<H: DependenceGraphHandler> {
    handler: H,
    storage: Box<dyn ConceptStorage>,
}

impl<H: DependenceGraphHandler> DependenceGraphAdapter<H> {
    pub fn new(handler: H, storage: Box<dyn ConceptStorage>) -> Self {
        Self { handler, storage }
    }
}

#[async_trait::async_trait]
impl<H: DependenceGraphHandler + 'static> ConceptTransport for DependenceGraphAdapter<H> {
    async fn invoke(&self, invocation: ActionInvocation) -> Result<ActionCompletion, Box<dyn std::error::Error>> {
        let result: Value = match invocation.action.as_str() {
            "compute" => {
                let input: DependenceGraphComputeInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.compute(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "queryDependents" => {
                let input: DependenceGraphQueryDependentsInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.query_dependents(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "queryDependencies" => {
                let input: DependenceGraphQueryDependenciesInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.query_dependencies(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "sliceForward" => {
                let input: DependenceGraphSliceForwardInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.slice_forward(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "sliceBackward" => {
                let input: DependenceGraphSliceBackwardInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.slice_backward(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "impactAnalysis" => {
                let input: DependenceGraphImpactAnalysisInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.impact_analysis(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "get" => {
                let input: DependenceGraphGetInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.get(input, self.storage.as_ref()).await?;
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
