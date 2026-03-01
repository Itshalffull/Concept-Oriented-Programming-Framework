// generated: builder/adapter.rs

use serde_json::Value;
use crate::transport::{
    ActionInvocation, ActionCompletion,
    ConceptTransport, ConceptQuery,
};
use crate::storage::ConceptStorage;
use super::handler::BuilderHandler;
use super::types::*;

pub struct BuilderAdapter<H: BuilderHandler> {
    handler: H,
    storage: Box<dyn ConceptStorage>,
}

impl<H: BuilderHandler> BuilderAdapter<H> {
    pub fn new(handler: H, storage: Box<dyn ConceptStorage>) -> Self {
        Self { handler, storage }
    }
}

#[async_trait::async_trait]
impl<H: BuilderHandler + 'static> ConceptTransport for BuilderAdapter<H> {
    async fn invoke(&self, invocation: ActionInvocation) -> Result<ActionCompletion, Box<dyn std::error::Error>> {
        let result: Value = match invocation.action.as_str() {
            "build" => {
                let input: BuilderBuildInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.build(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "buildAll" => {
                let input: BuilderBuildAllInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.build_all(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "test" => {
                let input: BuilderTestInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.test(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "status" => {
                let input: BuilderStatusInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.status(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "history" => {
                let input: BuilderHistoryInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.history(input, self.storage.as_ref()).await?;
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
