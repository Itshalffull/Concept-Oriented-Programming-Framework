// generated: group/adapter.rs

use serde_json::Value;
use crate::transport::{
    ActionInvocation, ActionCompletion,
    ConceptTransport, ConceptQuery,
};
use crate::storage::ConceptStorage;
use super::handler::GroupHandler;
use super::types::*;

pub struct GroupAdapter<H: GroupHandler> {
    handler: H,
    storage: Box<dyn ConceptStorage>,
}

impl<H: GroupHandler> GroupAdapter<H> {
    pub fn new(handler: H, storage: Box<dyn ConceptStorage>) -> Self {
        Self { handler, storage }
    }
}

#[async_trait::async_trait]
impl<H: GroupHandler + 'static> ConceptTransport for GroupAdapter<H> {
    async fn invoke(&self, invocation: ActionInvocation) -> Result<ActionCompletion, Box<dyn std::error::Error>> {
        let result: Value = match invocation.action.as_str() {
            "createGroup" => {
                let input: GroupCreateGroupInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.create_group(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "addMember" => {
                let input: GroupAddMemberInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.add_member(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "assignGroupRole" => {
                let input: GroupAssignGroupRoleInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.assign_group_role(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "addContent" => {
                let input: GroupAddContentInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.add_content(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "checkGroupAccess" => {
                let input: GroupCheckGroupAccessInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.check_group_access(input, self.storage.as_ref()).await?;
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
