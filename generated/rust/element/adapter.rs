// generated: element/adapter.rs

use serde_json::Value;
use crate::transport::{
    ActionInvocation, ActionCompletion,
    ConceptTransport, ConceptQuery,
};
use crate::storage::ConceptStorage;
use super::handler::ElementHandler;
use super::types::*;

pub struct ElementAdapter<H: ElementHandler> {
    handler: H,
    storage: Box<dyn ConceptStorage>,
}

impl<H: ElementHandler> ElementAdapter<H> {
    pub fn new(handler: H, storage: Box<dyn ConceptStorage>) -> Self {
        Self { handler, storage }
    }
}

#[async_trait::async_trait]
impl<H: ElementHandler + 'static> ConceptTransport for ElementAdapter<H> {
    async fn invoke(&self, invocation: ActionInvocation) -> Result<ActionCompletion, Box<dyn std::error::Error>> {
        let result: Value = match invocation.action.as_str() {
            "create" => {
                let input: ElementCreateInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.create(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "nest" => {
                let input: ElementNestInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.nest(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "setConstraints" => {
                let input: ElementSetConstraintsInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.set_constraints(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "enrich" => {
                let input: ElementEnrichInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.enrich(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "assignWidget" => {
                let input: ElementAssignWidgetInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.assign_widget(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "remove" => {
                let input: ElementRemoveInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.remove(input, self.storage.as_ref()).await?;
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
