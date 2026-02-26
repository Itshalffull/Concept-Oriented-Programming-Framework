// generated: view/adapter.rs

use serde_json::Value;
use crate::transport::{
    ActionInvocation, ActionCompletion,
    ConceptTransport, ConceptQuery,
};
use crate::storage::ConceptStorage;
use super::handler::ViewHandler;
use super::types::*;

pub struct ViewAdapter<H: ViewHandler> {
    handler: H,
    storage: Box<dyn ConceptStorage>,
}

impl<H: ViewHandler> ViewAdapter<H> {
    pub fn new(handler: H, storage: Box<dyn ConceptStorage>) -> Self {
        Self { handler, storage }
    }
}

#[async_trait::async_trait]
impl<H: ViewHandler + 'static> ConceptTransport for ViewAdapter<H> {
    async fn invoke(&self, invocation: ActionInvocation) -> Result<ActionCompletion, Box<dyn std::error::Error>> {
        let result: Value = match invocation.action.as_str() {
            "create" => {
                let input: ViewCreateInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.create(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "setFilter" => {
                let input: ViewSetFilterInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.set_filter(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "setSort" => {
                let input: ViewSetSortInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.set_sort(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "setGroup" => {
                let input: ViewSetGroupInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.set_group(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "setVisibleFields" => {
                let input: ViewSetVisibleFieldsInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.set_visible_fields(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "changeLayout" => {
                let input: ViewChangeLayoutInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.change_layout(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "duplicate" => {
                let input: ViewDuplicateInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.duplicate(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "embed" => {
                let input: ViewEmbedInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.embed(input, self.storage.as_ref()).await?;
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
