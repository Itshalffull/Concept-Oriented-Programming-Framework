// generated: sync_pair/adapter.rs

use serde_json::Value;
use crate::transport::{
    ActionInvocation, ActionCompletion,
    ConceptTransport, ConceptQuery,
};
use crate::storage::ConceptStorage;
use super::handler::SyncPairHandler;
use super::types::*;

pub struct SyncPairAdapter<H: SyncPairHandler> {
    handler: H,
    storage: Box<dyn ConceptStorage>,
}

impl<H: SyncPairHandler> SyncPairAdapter<H> {
    pub fn new(handler: H, storage: Box<dyn ConceptStorage>) -> Self {
        Self { handler, storage }
    }
}

#[async_trait::async_trait]
impl<H: SyncPairHandler + 'static> ConceptTransport for SyncPairAdapter<H> {
    async fn invoke(&self, invocation: ActionInvocation) -> Result<ActionCompletion, Box<dyn std::error::Error>> {
        let result: Value = match invocation.action.as_str() {
            "link" => {
                let input: SyncPairLinkInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.link(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "sync" => {
                let input: SyncPairSyncInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.sync(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "detectConflicts" => {
                let input: SyncPairDetectConflictsInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.detect_conflicts(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "resolve" => {
                let input: SyncPairResolveInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.resolve(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "unlink" => {
                let input: SyncPairUnlinkInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.unlink(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "getChangeLog" => {
                let input: SyncPairGetChangeLogInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.get_change_log(input, self.storage.as_ref()).await?;
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
