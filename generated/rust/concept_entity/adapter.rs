// generated: concept_entity/adapter.rs

use serde_json::Value;
use crate::transport::{
    ActionInvocation, ActionCompletion,
    ConceptTransport, ConceptQuery,
};
use crate::storage::ConceptStorage;
use super::handler::ConceptEntityHandler;
use super::types::*;

pub struct ConceptEntityAdapter<H: ConceptEntityHandler> {
    handler: H,
    storage: Box<dyn ConceptStorage>,
}

impl<H: ConceptEntityHandler> ConceptEntityAdapter<H> {
    pub fn new(handler: H, storage: Box<dyn ConceptStorage>) -> Self {
        Self { handler, storage }
    }
}

#[async_trait::async_trait]
impl<H: ConceptEntityHandler + 'static> ConceptTransport for ConceptEntityAdapter<H> {
    async fn invoke(&self, invocation: ActionInvocation) -> Result<ActionCompletion, Box<dyn std::error::Error>> {
        let result: Value = match invocation.action.as_str() {
            "register" => {
                let input: ConceptEntityRegisterInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.register(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "get" => {
                let input: ConceptEntityGetInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.get(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "findByCapability" => {
                let input: ConceptEntityFindByCapabilityInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.find_by_capability(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "findByKit" => {
                let input: ConceptEntityFindByKitInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.find_by_kit(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "generatedArtifacts" => {
                let input: ConceptEntityGeneratedArtifactsInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.generated_artifacts(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "participatingSyncs" => {
                let input: ConceptEntityParticipatingSyncsInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.participating_syncs(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "checkCompatibility" => {
                let input: ConceptEntityCheckCompatibilityInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.check_compatibility(input, self.storage.as_ref()).await?;
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
