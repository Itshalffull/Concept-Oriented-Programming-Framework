// generated: widget_entity/adapter.rs

use serde_json::Value;
use crate::transport::{
    ActionInvocation, ActionCompletion,
    ConceptTransport, ConceptQuery,
};
use crate::storage::ConceptStorage;
use super::handler::WidgetEntityHandler;
use super::types::*;

pub struct WidgetEntityAdapter<H: WidgetEntityHandler> {
    handler: H,
    storage: Box<dyn ConceptStorage>,
}

impl<H: WidgetEntityHandler> WidgetEntityAdapter<H> {
    pub fn new(handler: H, storage: Box<dyn ConceptStorage>) -> Self {
        Self { handler, storage }
    }
}

#[async_trait::async_trait]
impl<H: WidgetEntityHandler + 'static> ConceptTransport for WidgetEntityAdapter<H> {
    async fn invoke(&self, invocation: ActionInvocation) -> Result<ActionCompletion, Box<dyn std::error::Error>> {
        let result: Value = match invocation.action.as_str() {
            "register" => {
                let input: WidgetEntityRegisterInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.register(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "get" => {
                let input: WidgetEntityGetInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.get(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "findByAffordance" => {
                let input: WidgetEntityFindByAffordanceInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.find_by_affordance(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "findComposing" => {
                let input: WidgetEntityFindComposingInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.find_composing(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "findComposedBy" => {
                let input: WidgetEntityFindComposedByInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.find_composed_by(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "generatedComponents" => {
                let input: WidgetEntityGeneratedComponentsInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.generated_components(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "accessibilityAudit" => {
                let input: WidgetEntityAccessibilityAuditInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.accessibility_audit(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "traceToConcept" => {
                let input: WidgetEntityTraceToConceptInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.trace_to_concept(input, self.storage.as_ref()).await?;
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
