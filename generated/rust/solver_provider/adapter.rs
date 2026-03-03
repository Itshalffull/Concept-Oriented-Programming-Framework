// generated: solver_provider/adapter.rs

use serde_json::Value;
use crate::transport::{
    ActionInvocation, ActionCompletion,
    ConceptTransport, ConceptQuery,
};
use crate::storage::ConceptStorage;
use super::handler::SolverProviderHandler;
use super::types::*;

pub struct SolverProviderAdapter<H: SolverProviderHandler> {
    handler: H,
    storage: Box<dyn ConceptStorage>,
}

impl<H: SolverProviderHandler> SolverProviderAdapter<H> {
    pub fn new(handler: H, storage: Box<dyn ConceptStorage>) -> Self {
        Self { handler, storage }
    }
}

#[async_trait::async_trait]
impl<H: SolverProviderHandler + 'static> ConceptTransport for SolverProviderAdapter<H> {
    async fn invoke(&self, invocation: ActionInvocation) -> Result<ActionCompletion, Box<dyn std::error::Error>> {
        let result: Value = match invocation.action.as_str() {
            "register" => {
                let input: SolverProviderRegisterInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.register(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "dispatch" => {
                let input: SolverProviderDispatchInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.dispatch(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "dispatch_batch" => {
                let input: SolverProviderDispatch_batchInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.dispatch_batch(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "health_check" => {
                let input: SolverProviderHealth_checkInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.health_check(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "list" => {
                let input: SolverProviderListInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.list(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "unregister" => {
                let input: SolverProviderUnregisterInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.unregister(input, self.storage.as_ref()).await?;
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