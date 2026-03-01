// generated: surface/adapter.rs

use serde_json::Value;
use crate::transport::{
    ActionInvocation, ActionCompletion,
    ConceptTransport, ConceptQuery,
};
use crate::storage::ConceptStorage;
use super::handler::SurfaceHandler;
use super::types::*;

pub struct SurfaceAdapter<H: SurfaceHandler> {
    handler: H,
    storage: Box<dyn ConceptStorage>,
}

impl<H: SurfaceHandler> SurfaceAdapter<H> {
    pub fn new(handler: H, storage: Box<dyn ConceptStorage>) -> Self {
        Self { handler, storage }
    }
}

#[async_trait::async_trait]
impl<H: SurfaceHandler + 'static> ConceptTransport for SurfaceAdapter<H> {
    async fn invoke(&self, invocation: ActionInvocation) -> Result<ActionCompletion, Box<dyn std::error::Error>> {
        let result: Value = match invocation.action.as_str() {
            "create" => {
                let input: SurfaceCreateInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.create(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "attach" => {
                let input: SurfaceAttachInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.attach(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "resize" => {
                let input: SurfaceResizeInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.resize(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "mount" => {
                let input: SurfaceMountInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.mount(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "unmount" => {
                let input: SurfaceUnmountInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.unmount(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "destroy" => {
                let input: SurfaceDestroyInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.destroy(input, self.storage.as_ref()).await?;
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
