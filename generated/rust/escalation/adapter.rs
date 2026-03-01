// Escalation concept transport adapter
// Routes action invocations to the appropriate handler methods.

use serde_json::Value;
use crate::transport::{
    ActionInvocation, ActionCompletion,
    ConceptTransport, ConceptQuery,
};
use crate::storage::ConceptStorage;
use super::handler::EscalationHandler;
use super::types::*;

pub struct EscalationAdapter<H: EscalationHandler> {
    handler: H,
    storage: Box<dyn ConceptStorage>,
}

impl<H: EscalationHandler> EscalationAdapter<H> {
    pub fn new(handler: H, storage: Box<dyn ConceptStorage>) -> Self {
        Self { handler, storage }
    }
}

#[async_trait::async_trait]
impl<H: EscalationHandler + 'static> ConceptTransport for EscalationAdapter<H> {
    async fn invoke(&self, invocation: ActionInvocation) -> Result<ActionCompletion, Box<dyn std::error::Error>> {
        let result: Value = match invocation.action.as_str() {
            "escalate" => {
                let input: EscalationEscalateInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.escalate(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "accept" => {
                let input: EscalationAcceptInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.accept(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "resolve" => {
                let input: EscalationResolveInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.resolve(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "re_escalate" => {
                let input: EscalationReEscalateInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.re_escalate(input, self.storage.as_ref()).await?;
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
