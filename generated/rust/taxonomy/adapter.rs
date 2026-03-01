// generated: taxonomy/adapter.rs

use serde_json::Value;
use crate::transport::{
    ActionInvocation, ActionCompletion,
    ConceptTransport, ConceptQuery,
};
use crate::storage::ConceptStorage;
use super::handler::TaxonomyHandler;
use super::types::*;

pub struct TaxonomyAdapter<H: TaxonomyHandler> {
    handler: H,
    storage: Box<dyn ConceptStorage>,
}

impl<H: TaxonomyHandler> TaxonomyAdapter<H> {
    pub fn new(handler: H, storage: Box<dyn ConceptStorage>) -> Self {
        Self { handler, storage }
    }
}

#[async_trait::async_trait]
impl<H: TaxonomyHandler + 'static> ConceptTransport for TaxonomyAdapter<H> {
    async fn invoke(&self, invocation: ActionInvocation) -> Result<ActionCompletion, Box<dyn std::error::Error>> {
        let result: Value = match invocation.action.as_str() {
            "createVocabulary" => {
                let input: TaxonomyCreateVocabularyInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.create_vocabulary(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "addTerm" => {
                let input: TaxonomyAddTermInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.add_term(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "setParent" => {
                let input: TaxonomySetParentInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.set_parent(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "tagEntity" => {
                let input: TaxonomyTagEntityInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.tag_entity(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "untagEntity" => {
                let input: TaxonomyUntagEntityInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.untag_entity(input, self.storage.as_ref()).await?;
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
