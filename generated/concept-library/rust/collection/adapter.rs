// generated: collection/adapter.rs

use serde_json::Value;
use crate::transport::{
    ActionInvocation, ActionCompletion,
    ConceptTransport, ConceptQuery,
};
use crate::storage::ConceptStorage;
use super::handler::CollectionHandler;
use super::types::*;

pub struct CollectionAdapter<H: CollectionHandler> {
    handler: H,
    storage: Box<dyn ConceptStorage>,
}

impl<H: CollectionHandler> CollectionAdapter<H> {
    pub fn new(handler: H, storage: Box<dyn ConceptStorage>) -> Self {
        Self { handler, storage }
    }
}

#[async_trait::async_trait]
impl<H: CollectionHandler + 'static> ConceptTransport for CollectionAdapter<H> {
    async fn invoke(&self, invocation: ActionInvocation) -> Result<ActionCompletion, Box<dyn std::error::Error>> {
        let result: Value = match invocation.action.as_str() {
            "create" => {
                let input: CollectionCreateInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.create(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "addMember" => {
                let input: CollectionAddMemberInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.add_member(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "removeMember" => {
                let input: CollectionRemoveMemberInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.remove_member(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "getMembers" => {
                let input: CollectionGetMembersInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.get_members(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "setSchema" => {
                let input: CollectionSetSchemaInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.set_schema(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "createVirtual" => {
                let input: CollectionCreateVirtualInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.create_virtual(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "materialize" => {
                let input: CollectionMaterializeInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.materialize(input, self.storage.as_ref()).await?;
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
