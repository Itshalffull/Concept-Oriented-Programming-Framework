// generated: data_quality/adapter.rs

use serde_json::Value;
use crate::transport::{
    ActionInvocation, ActionCompletion,
    ConceptTransport, ConceptQuery,
};
use crate::storage::ConceptStorage;
use super::handler::DataQualityHandler;
use super::types::*;

pub struct DataQualityAdapter<H: DataQualityHandler> {
    handler: H,
    storage: Box<dyn ConceptStorage>,
}

impl<H: DataQualityHandler> DataQualityAdapter<H> {
    pub fn new(handler: H, storage: Box<dyn ConceptStorage>) -> Self {
        Self { handler, storage }
    }
}

#[async_trait::async_trait]
impl<H: DataQualityHandler + 'static> ConceptTransport for DataQualityAdapter<H> {
    async fn invoke(&self, invocation: ActionInvocation) -> Result<ActionCompletion, Box<dyn std::error::Error>> {
        let result: Value = match invocation.action.as_str() {
            "validate" => {
                let input: DataQualityValidateInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.validate(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "quarantine" => {
                let input: DataQualityQuarantineInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.quarantine(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "release" => {
                let input: DataQualityReleaseInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.release(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "profile" => {
                let input: DataQualityProfileInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.profile(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "reconcile" => {
                let input: DataQualityReconcileInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.reconcile(input, self.storage.as_ref()).await?;
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
