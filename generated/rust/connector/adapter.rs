// generated: connector/adapter.rs

use serde_json::Value;
use crate::transport::{
    ActionInvocation, ActionCompletion,
    ConceptTransport, ConceptQuery,
};
use crate::storage::ConceptStorage;
use super::handler::ConnectorHandler;
use super::types::*;

pub struct ConnectorAdapter<H: ConnectorHandler> {
    handler: H,
    storage: Box<dyn ConceptStorage>,
}

impl<H: ConnectorHandler> ConnectorAdapter<H> {
    pub fn new(handler: H, storage: Box<dyn ConceptStorage>) -> Self {
        Self { handler, storage }
    }
}

#[async_trait::async_trait]
impl<H: ConnectorHandler + 'static> ConceptTransport for ConnectorAdapter<H> {
    async fn invoke(&self, invocation: ActionInvocation) -> Result<ActionCompletion, Box<dyn std::error::Error>> {
        let result: Value = match invocation.action.as_str() {
            "configure" => {
                let input: ConnectorConfigureInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.configure(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "read" => {
                let input: ConnectorReadInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.read(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "write" => {
                let input: ConnectorWriteInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.write(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "test" => {
                let input: ConnectorTestInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.test(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "discover" => {
                let input: ConnectorDiscoverInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.discover(input, self.storage.as_ref()).await?;
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
