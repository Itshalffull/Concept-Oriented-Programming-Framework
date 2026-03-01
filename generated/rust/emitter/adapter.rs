// generated: emitter/adapter.rs

use serde_json::Value;
use crate::transport::{
    ActionInvocation, ActionCompletion,
    ConceptTransport, ConceptQuery,
};
use crate::storage::ConceptStorage;
use super::handler::EmitterHandler;
use super::types::*;

pub struct EmitterAdapter<H: EmitterHandler> {
    handler: H,
    storage: Box<dyn ConceptStorage>,
}

impl<H: EmitterHandler> EmitterAdapter<H> {
    pub fn new(handler: H, storage: Box<dyn ConceptStorage>) -> Self {
        Self { handler, storage }
    }
}

#[async_trait::async_trait]
impl<H: EmitterHandler + 'static> ConceptTransport for EmitterAdapter<H> {
    async fn invoke(&self, invocation: ActionInvocation) -> Result<ActionCompletion, Box<dyn std::error::Error>> {
        let result: Value = match invocation.action.as_str() {
            "write" => {
                let input: EmitterWriteInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.write(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "writeBatch" => {
                let input: EmitterWriteBatchInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.write_batch(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "format" => {
                let input: EmitterFormatInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.format(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "clean" => {
                let input: EmitterCleanInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.clean(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "manifest" => {
                let input: EmitterManifestInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.manifest(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "trace" => {
                let input: EmitterTraceInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.trace(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "affected" => {
                let input: EmitterAffectedInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.affected(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "audit" => {
                let input: EmitterAuditInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.audit(input, self.storage.as_ref()).await?;
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
