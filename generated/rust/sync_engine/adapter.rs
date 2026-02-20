// generated: sync_engine/adapter.rs

use serde_json::Value;
use crate::transport::{
    ActionInvocation, ActionCompletion,
    ConceptTransport, ConceptQuery,
};
use crate::storage::ConceptStorage;
use super::handler::SyncEngineHandler;
use super::types::*;

pub struct SyncEngineAdapter<H: SyncEngineHandler> {
    handler: H,
    storage: Box<dyn ConceptStorage>,
}

impl<H: SyncEngineHandler> SyncEngineAdapter<H> {
    pub fn new(handler: H, storage: Box<dyn ConceptStorage>) -> Self {
        Self { handler, storage }
    }
}

#[async_trait::async_trait]
impl<H: SyncEngineHandler + 'static> ConceptTransport for SyncEngineAdapter<H> {
    async fn invoke(&self, invocation: ActionInvocation) -> Result<ActionCompletion, Box<dyn std::error::Error>> {
        let result: Value = match invocation.action.as_str() {
            "registerSync" => {
                let input: SyncEngineRegisterSyncInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.register_sync(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "onCompletion" => {
                let input: SyncEngineOnCompletionInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.on_completion(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "evaluateWhere" => {
                let input: SyncEngineEvaluateWhereInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.evaluate_where(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "queueSync" => {
                let input: SyncEngineQueueSyncInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.queue_sync(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "onAvailabilityChange" => {
                let input: SyncEngineOnAvailabilityChangeInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.on_availability_change(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "drainConflicts" => {
                let input: SyncEngineDrainConflictsInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.drain_conflicts(input, self.storage.as_ref()).await?;
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
