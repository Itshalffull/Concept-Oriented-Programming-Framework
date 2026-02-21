// generated: relation/adapter.rs

use serde_json::Value;
use crate::transport::{
    ActionInvocation, ActionCompletion,
    ConceptTransport, ConceptQuery,
};
use crate::storage::ConceptStorage;
use super::handler::RelationHandler;
use super::types::*;

pub struct RelationAdapter<H: RelationHandler> {
    handler: H,
    storage: Box<dyn ConceptStorage>,
}

impl<H: RelationHandler> RelationAdapter<H> {
    pub fn new(handler: H, storage: Box<dyn ConceptStorage>) -> Self {
        Self { handler, storage }
    }
}

#[async_trait::async_trait]
impl<H: RelationHandler + 'static> ConceptTransport for RelationAdapter<H> {
    async fn invoke(&self, invocation: ActionInvocation) -> Result<ActionCompletion, Box<dyn std::error::Error>> {
        let result: Value = match invocation.action.as_str() {
            "defineRelation" => {
                let input: RelationDefineRelationInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.define_relation(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "link" => {
                let input: RelationLinkInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.link(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "unlink" => {
                let input: RelationUnlinkInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.unlink(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "getRelated" => {
                let input: RelationGetRelatedInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.get_related(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "defineRollup" => {
                let input: RelationDefineRollupInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.define_rollup(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "computeRollup" => {
                let input: RelationComputeRollupInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.compute_rollup(input, self.storage.as_ref()).await?;
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
