// generated: build_cache/adapter.rs

use serde_json::Value;
use crate::transport::{
    ActionInvocation, ActionCompletion,
    ConceptTransport, ConceptQuery,
};
use crate::storage::ConceptStorage;
use super::handler::BuildCacheHandler;
use super::types::*;

pub struct BuildCacheAdapter<H: BuildCacheHandler> {
    handler: H,
    storage: Box<dyn ConceptStorage>,
}

impl<H: BuildCacheHandler> BuildCacheAdapter<H> {
    pub fn new(handler: H, storage: Box<dyn ConceptStorage>) -> Self {
        Self { handler, storage }
    }
}

#[async_trait::async_trait]
impl<H: BuildCacheHandler + 'static> ConceptTransport for BuildCacheAdapter<H> {
    async fn invoke(&self, invocation: ActionInvocation) -> Result<ActionCompletion, Box<dyn std::error::Error>> {
        let result: Value = match invocation.action.as_str() {
            "check" => {
                let input: BuildCacheCheckInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.check(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "record" => {
                let input: BuildCacheRecordInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.record(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "invalidate" => {
                let input: BuildCacheInvalidateInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.invalidate(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "invalidateBySource" => {
                let input: BuildCacheInvalidateBySourceInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.invalidate_by_source(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "invalidateByKind" => {
                let input: BuildCacheInvalidateByKindInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.invalidate_by_kind(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "invalidateAll" => {
                let input: BuildCacheInvalidateAllInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.invalidate_all(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "status" => {
                let input: BuildCacheStatusInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.status(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "staleSteps" => {
                let input: BuildCacheStaleStepsInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.stale_steps(input, self.storage.as_ref()).await?;
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
