// generated: schema/adapter.rs

use serde_json::Value;
use crate::transport::{
    ActionInvocation, ActionCompletion,
    ConceptTransport, ConceptQuery,
};
use crate::storage::ConceptStorage;
use super::handler::SchemaHandler;
use super::types::*;

pub struct SchemaAdapter<H: SchemaHandler> {
    handler: H,
    storage: Box<dyn ConceptStorage>,
}

impl<H: SchemaHandler> SchemaAdapter<H> {
    pub fn new(handler: H, storage: Box<dyn ConceptStorage>) -> Self {
        Self { handler, storage }
    }
}

#[async_trait::async_trait]
impl<H: SchemaHandler + 'static> ConceptTransport for SchemaAdapter<H> {
    async fn invoke(&self, invocation: ActionInvocation) -> Result<ActionCompletion, Box<dyn std::error::Error>> {
        let result: Value = match invocation.action.as_str() {
            "defineSchema" => {
                let input: SchemaDefineSchemaInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.define_schema(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "addField" => {
                let input: SchemaAddFieldInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.add_field(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "extendSchema" => {
                let input: SchemaExtendSchemaInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.extend_schema(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "applyTo" => {
                let input: SchemaApplyToInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.apply_to(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "removeFrom" => {
                let input: SchemaRemoveFromInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.remove_from(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "getAssociations" => {
                let input: SchemaGetAssociationsInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.get_associations(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "export" => {
                let input: SchemaExportInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.export(input, self.storage.as_ref()).await?;
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
