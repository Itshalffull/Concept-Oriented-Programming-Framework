// generated: host/adapter.rs

use serde_json::Value;
use crate::transport::{
    ActionInvocation, ActionCompletion,
    ConceptTransport, ConceptQuery,
};
use crate::storage::ConceptStorage;
use super::handler::HostHandler;
use super::types::*;

pub struct HostAdapter<H: HostHandler> {
    handler: H,
    storage: Box<dyn ConceptStorage>,
}

impl<H: HostHandler> HostAdapter<H> {
    pub fn new(handler: H, storage: Box<dyn ConceptStorage>) -> Self {
        Self { handler, storage }
    }
}

#[async_trait::async_trait]
impl<H: HostHandler + 'static> ConceptTransport for HostAdapter<H> {
    async fn invoke(&self, invocation: ActionInvocation) -> Result<ActionCompletion, Box<dyn std::error::Error>> {
        let result: Value = match invocation.action.as_str() {
            "mount" => {
                let input: HostMountInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.mount(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "ready" => {
                let input: HostReadyInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.ready(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "trackResource" => {
                let input: HostTrackResourceInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.track_resource(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "unmount" => {
                let input: HostUnmountInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.unmount(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "refresh" => {
                let input: HostRefreshInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.refresh(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "setError" => {
                let input: HostSetErrorInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.set_error(input, self.storage.as_ref()).await?;
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
