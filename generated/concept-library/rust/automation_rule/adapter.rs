// generated: automation_rule/adapter.rs

use serde_json::Value;
use crate::transport::{
    ActionInvocation, ActionCompletion,
    ConceptTransport, ConceptQuery,
};
use crate::storage::ConceptStorage;
use super::handler::AutomationRuleHandler;
use super::types::*;

pub struct AutomationRuleAdapter<H: AutomationRuleHandler> {
    handler: H,
    storage: Box<dyn ConceptStorage>,
}

impl<H: AutomationRuleHandler> AutomationRuleAdapter<H> {
    pub fn new(handler: H, storage: Box<dyn ConceptStorage>) -> Self {
        Self { handler, storage }
    }
}

#[async_trait::async_trait]
impl<H: AutomationRuleHandler + 'static> ConceptTransport for AutomationRuleAdapter<H> {
    async fn invoke(&self, invocation: ActionInvocation) -> Result<ActionCompletion, Box<dyn std::error::Error>> {
        let result: Value = match invocation.action.as_str() {
            "define" => {
                let input: AutomationRuleDefineInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.define(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "enable" => {
                let input: AutomationRuleEnableInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.enable(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "disable" => {
                let input: AutomationRuleDisableInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.disable(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "evaluate" => {
                let input: AutomationRuleEvaluateInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.evaluate(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "execute" => {
                let input: AutomationRuleExecuteInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.execute(input, self.storage.as_ref()).await?;
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
