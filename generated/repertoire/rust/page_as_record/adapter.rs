// generated: page_as_record/adapter.rs

use serde_json::Value;
use crate::transport::{
    ActionInvocation, ActionCompletion,
    ConceptTransport, ConceptQuery,
};
use crate::storage::ConceptStorage;
use super::handler::PageAsRecordHandler;
use super::types::*;

pub struct PageAsRecordAdapter<H: PageAsRecordHandler> {
    handler: H,
    storage: Box<dyn ConceptStorage>,
}

impl<H: PageAsRecordHandler> PageAsRecordAdapter<H> {
    pub fn new(handler: H, storage: Box<dyn ConceptStorage>) -> Self {
        Self { handler, storage }
    }
}

#[async_trait::async_trait]
impl<H: PageAsRecordHandler + 'static> ConceptTransport for PageAsRecordAdapter<H> {
    async fn invoke(&self, invocation: ActionInvocation) -> Result<ActionCompletion, Box<dyn std::error::Error>> {
        let result: Value = match invocation.action.as_str() {
            "create" => {
                let input: PageAsRecordCreateInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.create(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "setProperty" => {
                let input: PageAsRecordSetPropertyInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.set_property(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "getProperty" => {
                let input: PageAsRecordGetPropertyInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.get_property(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "appendToBody" => {
                let input: PageAsRecordAppendToBodyInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.append_to_body(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "attachToSchema" => {
                let input: PageAsRecordAttachToSchemaInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.attach_to_schema(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "convertFromFreeform" => {
                let input: PageAsRecordConvertFromFreeformInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.convert_from_freeform(input, self.storage.as_ref()).await?;
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
