// generated: interactor_entity/adapter.rs

use serde_json::Value;
use crate::transport::{
    ActionInvocation, ActionCompletion,
    ConceptTransport, ConceptQuery,
};
use crate::storage::ConceptStorage;
use super::handler::InteractorEntityHandler;
use super::types::*;

pub struct InteractorEntityAdapter<H: InteractorEntityHandler> {
    handler: H,
    storage: Box<dyn ConceptStorage>,
}

impl<H: InteractorEntityHandler> InteractorEntityAdapter<H> {
    pub fn new(handler: H, storage: Box<dyn ConceptStorage>) -> Self {
        Self { handler, storage }
    }
}

#[async_trait::async_trait]
impl<H: InteractorEntityHandler + 'static> ConceptTransport for InteractorEntityAdapter<H> {
    async fn invoke(&self, invocation: ActionInvocation) -> Result<ActionCompletion, Box<dyn std::error::Error>> {
        let result: Value = match invocation.action.as_str() {
            "register" => {
                let input: InteractorEntityRegisterInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.register(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "findByCategory" => {
                let input: InteractorEntityFindByCategoryInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.find_by_category(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "matchingWidgets" => {
                let input: InteractorEntityMatchingWidgetsInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.matching_widgets(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "classifiedFields" => {
                let input: InteractorEntityClassifiedFieldsInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.classified_fields(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "coverageReport" => {
                let input: InteractorEntityCoverageReportInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.coverage_report(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "get" => {
                let input: InteractorEntityGetInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.get(input, self.storage.as_ref()).await?;
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
