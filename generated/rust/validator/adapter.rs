// generated: validator/adapter.rs

use serde_json::Value;
use crate::transport::{
    ActionInvocation, ActionCompletion,
    ConceptTransport, ConceptQuery,
};
use crate::storage::ConceptStorage;
use super::handler::ValidatorHandler;
use super::types::*;

pub struct ValidatorAdapter<H: ValidatorHandler> {
    handler: H,
    storage: Box<dyn ConceptStorage>,
}

impl<H: ValidatorHandler> ValidatorAdapter<H> {
    pub fn new(handler: H, storage: Box<dyn ConceptStorage>) -> Self {
        Self { handler, storage }
    }
}

#[async_trait::async_trait]
impl<H: ValidatorHandler + 'static> ConceptTransport for ValidatorAdapter<H> {
    async fn invoke(&self, invocation: ActionInvocation) -> Result<ActionCompletion, Box<dyn std::error::Error>> {
        let result: Value = match invocation.action.as_str() {
            "registerConstraint" => {
                let input: ValidatorRegisterConstraintInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.register_constraint(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "addRule" => {
                let input: ValidatorAddRuleInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.add_rule(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "validate" => {
                let input: ValidatorValidateInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.validate(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "validateField" => {
                let input: ValidatorValidateFieldInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.validate_field(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "addCustomValidator" => {
                let input: ValidatorAddCustomValidatorInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.add_custom_validator(input, self.storage.as_ref()).await?;
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
