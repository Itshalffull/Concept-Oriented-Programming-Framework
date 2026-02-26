// generated: formula/adapter.rs

use serde_json::Value;
use crate::transport::{
    ActionInvocation, ActionCompletion,
    ConceptTransport, ConceptQuery,
};
use crate::storage::ConceptStorage;
use super::handler::FormulaHandler;
use super::types::*;

pub struct FormulaAdapter<H: FormulaHandler> {
    handler: H,
    storage: Box<dyn ConceptStorage>,
}

impl<H: FormulaHandler> FormulaAdapter<H> {
    pub fn new(handler: H, storage: Box<dyn ConceptStorage>) -> Self {
        Self { handler, storage }
    }
}

#[async_trait::async_trait]
impl<H: FormulaHandler + 'static> ConceptTransport for FormulaAdapter<H> {
    async fn invoke(&self, invocation: ActionInvocation) -> Result<ActionCompletion, Box<dyn std::error::Error>> {
        let result: Value = match invocation.action.as_str() {
            "create" => {
                let input: FormulaCreateInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.create(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "evaluate" => {
                let input: FormulaEvaluateInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.evaluate(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "getDependencies" => {
                let input: FormulaGetDependenciesInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.get_dependencies(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "invalidate" => {
                let input: FormulaInvalidateInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.invalidate(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "setExpression" => {
                let input: FormulaSetExpressionInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.set_expression(input, self.storage.as_ref()).await?;
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
