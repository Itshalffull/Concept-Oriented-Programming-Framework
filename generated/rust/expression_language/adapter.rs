// generated: expression_language/adapter.rs

use serde_json::Value;
use crate::transport::{
    ActionInvocation, ActionCompletion,
    ConceptTransport, ConceptQuery,
};
use crate::storage::ConceptStorage;
use super::handler::ExpressionLanguageHandler;
use super::types::*;

pub struct ExpressionLanguageAdapter<H: ExpressionLanguageHandler> {
    handler: H,
    storage: Box<dyn ConceptStorage>,
}

impl<H: ExpressionLanguageHandler> ExpressionLanguageAdapter<H> {
    pub fn new(handler: H, storage: Box<dyn ConceptStorage>) -> Self {
        Self { handler, storage }
    }
}

#[async_trait::async_trait]
impl<H: ExpressionLanguageHandler + 'static> ConceptTransport for ExpressionLanguageAdapter<H> {
    async fn invoke(&self, invocation: ActionInvocation) -> Result<ActionCompletion, Box<dyn std::error::Error>> {
        let result: Value = match invocation.action.as_str() {
            "registerLanguage" => {
                let input: ExpressionLanguageRegisterLanguageInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.register_language(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "registerFunction" => {
                let input: ExpressionLanguageRegisterFunctionInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.register_function(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "registerOperator" => {
                let input: ExpressionLanguageRegisterOperatorInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.register_operator(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "parse" => {
                let input: ExpressionLanguageParseInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.parse(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "evaluate" => {
                let input: ExpressionLanguageEvaluateInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.evaluate(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "typeCheck" => {
                let input: ExpressionLanguageTypeCheckInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.type_check(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "getCompletions" => {
                let input: ExpressionLanguageGetCompletionsInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.get_completions(input, self.storage.as_ref()).await?;
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
