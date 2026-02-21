// generated: file_management/adapter.rs

use serde_json::Value;
use crate::transport::{
    ActionInvocation, ActionCompletion,
    ConceptTransport, ConceptQuery,
};
use crate::storage::ConceptStorage;
use super::handler::FileManagementHandler;
use super::types::*;

pub struct FileManagementAdapter<H: FileManagementHandler> {
    handler: H,
    storage: Box<dyn ConceptStorage>,
}

impl<H: FileManagementHandler> FileManagementAdapter<H> {
    pub fn new(handler: H, storage: Box<dyn ConceptStorage>) -> Self {
        Self { handler, storage }
    }
}

#[async_trait::async_trait]
impl<H: FileManagementHandler + 'static> ConceptTransport for FileManagementAdapter<H> {
    async fn invoke(&self, invocation: ActionInvocation) -> Result<ActionCompletion, Box<dyn std::error::Error>> {
        let result: Value = match invocation.action.as_str() {
            "upload" => {
                let input: FileManagementUploadInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.upload(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "addUsage" => {
                let input: FileManagementAddUsageInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.add_usage(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "removeUsage" => {
                let input: FileManagementRemoveUsageInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.remove_usage(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "garbageCollect" => {
                let input: FileManagementGarbageCollectInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.garbage_collect(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "getFile" => {
                let input: FileManagementGetFileInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.get_file(input, self.storage.as_ref()).await?;
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
