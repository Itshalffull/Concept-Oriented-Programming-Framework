// generated: flag/adapter.rs

use serde_json::Value;
use crate::transport::{
    ActionInvocation, ActionCompletion,
    ConceptTransport, ConceptQuery,
};
use crate::storage::ConceptStorage;
use super::handler::FlagHandler;
use super::types::*;

pub struct FlagAdapter<H: FlagHandler> {
    handler: H,
    storage: Box<dyn ConceptStorage>,
}

impl<H: FlagHandler> FlagAdapter<H> {
    pub fn new(handler: H, storage: Box<dyn ConceptStorage>) -> Self {
        Self { handler, storage }
    }
}

#[async_trait::async_trait]
impl<H: FlagHandler + 'static> ConceptTransport for FlagAdapter<H> {
    async fn invoke(&self, invocation: ActionInvocation) -> Result<ActionCompletion, Box<dyn std::error::Error>> {
        let result: Value = match invocation.action.as_str() {
            "flag" => {
                let input: FlagFlagInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.flag(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "unflag" => {
                let input: FlagUnflagInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.unflag(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "isFlagged" => {
                let input: FlagIsFlaggedInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.is_flagged(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "getCount" => {
                let input: FlagGetCountInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.get_count(input, self.storage.as_ref()).await?;
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
