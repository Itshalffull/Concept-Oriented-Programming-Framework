// generated: symbol/adapter.rs

use serde_json::Value;
use crate::transport::{
    ActionInvocation, ActionCompletion,
    ConceptTransport, ConceptQuery,
};
use crate::storage::ConceptStorage;
use super::handler::SymbolHandler;
use super::types::*;

pub struct SymbolAdapter<H: SymbolHandler> {
    handler: H,
    storage: Box<dyn ConceptStorage>,
}

impl<H: SymbolHandler> SymbolAdapter<H> {
    pub fn new(handler: H, storage: Box<dyn ConceptStorage>) -> Self {
        Self { handler, storage }
    }
}

#[async_trait::async_trait]
impl<H: SymbolHandler + 'static> ConceptTransport for SymbolAdapter<H> {
    async fn invoke(&self, invocation: ActionInvocation) -> Result<ActionCompletion, Box<dyn std::error::Error>> {
        let result: Value = match invocation.action.as_str() {
            "register" => {
                let input: SymbolRegisterInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.register(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "resolve" => {
                let input: SymbolResolveInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.resolve(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "findByKind" => {
                let input: SymbolFindByKindInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.find_by_kind(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "findByFile" => {
                let input: SymbolFindByFileInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.find_by_file(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "rename" => {
                let input: SymbolRenameInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.rename(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "get" => {
                let input: SymbolGetInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.get(input, self.storage.as_ref()).await?;
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
