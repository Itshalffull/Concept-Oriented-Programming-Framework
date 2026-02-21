// generated: config_sync/adapter.rs

use serde_json::Value;
use crate::transport::{
    ActionInvocation, ActionCompletion,
    ConceptTransport, ConceptQuery,
};
use crate::storage::ConceptStorage;
use super::handler::ConfigSyncHandler;
use super::types::*;

pub struct ConfigSyncAdapter<H: ConfigSyncHandler> {
    handler: H,
    storage: Box<dyn ConceptStorage>,
}

impl<H: ConfigSyncHandler> ConfigSyncAdapter<H> {
    pub fn new(handler: H, storage: Box<dyn ConceptStorage>) -> Self {
        Self { handler, storage }
    }
}

#[async_trait::async_trait]
impl<H: ConfigSyncHandler + 'static> ConceptTransport for ConfigSyncAdapter<H> {
    async fn invoke(&self, invocation: ActionInvocation) -> Result<ActionCompletion, Box<dyn std::error::Error>> {
        let result: Value = match invocation.action.as_str() {
            "export" => {
                let input: ConfigSyncExportInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.export(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "import" => {
                let input: ConfigSyncImportInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.import(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "override" => {
                let input: ConfigSyncOverrideInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.override(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "diff" => {
                let input: ConfigSyncDiffInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.diff(input, self.storage.as_ref()).await?;
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
