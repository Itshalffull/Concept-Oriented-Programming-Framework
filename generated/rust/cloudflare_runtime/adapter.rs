// generated: cloudflare_runtime/adapter.rs

use serde_json::Value;
use crate::transport::{
    ActionInvocation, ActionCompletion,
    ConceptTransport, ConceptQuery,
};
use crate::storage::ConceptStorage;
use super::handler::CloudflareRuntimeHandler;
use super::types::*;

pub struct CloudflareRuntimeAdapter<H: CloudflareRuntimeHandler> {
    handler: H,
    storage: Box<dyn ConceptStorage>,
}

impl<H: CloudflareRuntimeHandler> CloudflareRuntimeAdapter<H> {
    pub fn new(handler: H, storage: Box<dyn ConceptStorage>) -> Self {
        Self { handler, storage }
    }
}

#[async_trait::async_trait]
impl<H: CloudflareRuntimeHandler + 'static> ConceptTransport for CloudflareRuntimeAdapter<H> {
    async fn invoke(&self, invocation: ActionInvocation) -> Result<ActionCompletion, Box<dyn std::error::Error>> {
        let result: Value = match invocation.action.as_str() {
            "provision" => {
                let input: CloudflareRuntimeProvisionInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.provision(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "deploy" => {
                let input: CloudflareRuntimeDeployInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.deploy(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "setTrafficWeight" => {
                let input: CloudflareRuntimeSetTrafficWeightInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.set_traffic_weight(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "rollback" => {
                let input: CloudflareRuntimeRollbackInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.rollback(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "destroy" => {
                let input: CloudflareRuntimeDestroyInput = serde_json::from_value(invocation.input.clone())?;
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
