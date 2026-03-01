// generated: performance_profile/adapter.rs

use serde_json::Value;
use crate::transport::{
    ActionInvocation, ActionCompletion,
    ConceptTransport, ConceptQuery,
};
use crate::storage::ConceptStorage;
use super::handler::PerformanceProfileHandler;
use super::types::*;

pub struct PerformanceProfileAdapter<H: PerformanceProfileHandler> {
    handler: H,
    storage: Box<dyn ConceptStorage>,
}

impl<H: PerformanceProfileHandler> PerformanceProfileAdapter<H> {
    pub fn new(handler: H, storage: Box<dyn ConceptStorage>) -> Self {
        Self { handler, storage }
    }
}

#[async_trait::async_trait]
impl<H: PerformanceProfileHandler + 'static> ConceptTransport for PerformanceProfileAdapter<H> {
    async fn invoke(&self, invocation: ActionInvocation) -> Result<ActionCompletion, Box<dyn std::error::Error>> {
        let result: Value = match invocation.action.as_str() {
            "aggregate" => {
                let input: PerformanceProfileAggregateInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.aggregate(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "hotspots" => {
                let input: PerformanceProfileHotspotsInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.hotspots(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "slowChains" => {
                let input: PerformanceProfileSlowChainsInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.slow_chains(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "compareWindows" => {
                let input: PerformanceProfileCompareWindowsInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.compare_windows(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "get" => {
                let input: PerformanceProfileGetInput = serde_json::from_value(invocation.input.clone())?;
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
