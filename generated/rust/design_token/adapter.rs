// generated: design_token/adapter.rs

use serde_json::Value;
use crate::transport::{
    ActionInvocation, ActionCompletion,
    ConceptTransport, ConceptQuery,
};
use crate::storage::ConceptStorage;
use super::handler::DesignTokenHandler;
use super::types::*;

pub struct DesignTokenAdapter<H: DesignTokenHandler> {
    handler: H,
    storage: Box<dyn ConceptStorage>,
}

impl<H: DesignTokenHandler> DesignTokenAdapter<H> {
    pub fn new(handler: H, storage: Box<dyn ConceptStorage>) -> Self {
        Self { handler, storage }
    }
}

#[async_trait::async_trait]
impl<H: DesignTokenHandler + 'static> ConceptTransport for DesignTokenAdapter<H> {
    async fn invoke(&self, invocation: ActionInvocation) -> Result<ActionCompletion, Box<dyn std::error::Error>> {
        let result: Value = match invocation.action.as_str() {
            "define" => {
                let input: DesignTokenDefineInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.define(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "alias" => {
                let input: DesignTokenAliasInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.alias(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "resolve" => {
                let input: DesignTokenResolveInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.resolve(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "update" => {
                let input: DesignTokenUpdateInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.update(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "remove" => {
                let input: DesignTokenRemoveInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.remove(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "export" => {
                let input: DesignTokenExportInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.export(input, self.storage.as_ref()).await?;
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
