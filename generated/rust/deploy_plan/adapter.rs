// generated: deploy_plan/adapter.rs

use serde_json::Value;
use crate::transport::{
    ActionInvocation, ActionCompletion,
    ConceptTransport, ConceptQuery,
};
use crate::storage::ConceptStorage;
use super::handler::DeployPlanHandler;
use super::types::*;

pub struct DeployPlanAdapter<H: DeployPlanHandler> {
    handler: H,
    storage: Box<dyn ConceptStorage>,
}

impl<H: DeployPlanHandler> DeployPlanAdapter<H> {
    pub fn new(handler: H, storage: Box<dyn ConceptStorage>) -> Self {
        Self { handler, storage }
    }
}

#[async_trait::async_trait]
impl<H: DeployPlanHandler + 'static> ConceptTransport for DeployPlanAdapter<H> {
    async fn invoke(&self, invocation: ActionInvocation) -> Result<ActionCompletion, Box<dyn std::error::Error>> {
        let result: Value = match invocation.action.as_str() {
            "plan" => {
                let input: DeployPlanPlanInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.plan(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "validate" => {
                let input: DeployPlanValidateInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.validate(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "execute" => {
                let input: DeployPlanExecuteInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.execute(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "rollback" => {
                let input: DeployPlanRollbackInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.rollback(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "status" => {
                let input: DeployPlanStatusInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.status(input, self.storage.as_ref()).await?;
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
