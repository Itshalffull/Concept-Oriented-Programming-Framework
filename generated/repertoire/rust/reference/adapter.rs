// generated: reference/adapter.rs

use serde_json::Value;
use crate::transport::{
    ActionInvocation, ActionCompletion,
    ConceptTransport, ConceptQuery,
};
use crate::storage::ConceptStorage;
use super::handler::ReferenceHandler;
use super::types::*;

pub struct ReferenceAdapter<H: ReferenceHandler> {
    handler: H,
    storage: Box<dyn ConceptStorage>,
}

impl<H: ReferenceHandler> ReferenceAdapter<H> {
    pub fn new(handler: H, storage: Box<dyn ConceptStorage>) -> Self {
        Self { handler, storage }
    }
}

#[async_trait::async_trait]
impl<H: ReferenceHandler + 'static> ConceptTransport for ReferenceAdapter<H> {
    async fn invoke(&self, invocation: ActionInvocation) -> Result<ActionCompletion, Box<dyn std::error::Error>> {
        let result: Value = match invocation.action.as_str() {
            "addRef" => {
                let input: ReferenceAddRefInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.add_ref(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "removeRef" => {
                let input: ReferenceRemoveRefInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.remove_ref(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "getRefs" => {
                let input: ReferenceGetRefsInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.get_refs(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "resolveTarget" => {
                let input: ReferenceResolveTargetInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.resolve_target(input, self.storage.as_ref()).await?;
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
