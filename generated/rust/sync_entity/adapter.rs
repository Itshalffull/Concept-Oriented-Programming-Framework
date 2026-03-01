// generated: sync_entity/adapter.rs

use serde_json::Value;
use crate::transport::{
    ActionInvocation, ActionCompletion,
    ConceptTransport, ConceptQuery,
};
use crate::storage::ConceptStorage;
use super::handler::SyncEntityHandler;
use super::types::*;

pub struct SyncEntityAdapter<H: SyncEntityHandler> {
    handler: H,
    storage: Box<dyn ConceptStorage>,
}

impl<H: SyncEntityHandler> SyncEntityAdapter<H> {
    pub fn new(handler: H, storage: Box<dyn ConceptStorage>) -> Self {
        Self { handler, storage }
    }
}

#[async_trait::async_trait]
impl<H: SyncEntityHandler + 'static> ConceptTransport for SyncEntityAdapter<H> {
    async fn invoke(&self, invocation: ActionInvocation) -> Result<ActionCompletion, Box<dyn std::error::Error>> {
        let result: Value = match invocation.action.as_str() {
            "register" => {
                let input: SyncEntityRegisterInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.register(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "findByConcept" => {
                let input: SyncEntityFindByConceptInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.find_by_concept(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "findTriggerableBy" => {
                let input: SyncEntityFindTriggerableByInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.find_triggerable_by(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "chainFrom" => {
                let input: SyncEntityChainFromInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.chain_from(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "findDeadEnds" => {
                let input: SyncEntityFindDeadEndsInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.find_dead_ends(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "findOrphanVariants" => {
                let input: SyncEntityFindOrphanVariantsInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.find_orphan_variants(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "get" => {
                let input: SyncEntityGetInput = serde_json::from_value(invocation.input.clone())?;
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
