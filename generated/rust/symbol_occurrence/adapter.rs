// generated: symbol_occurrence/adapter.rs

use serde_json::Value;
use crate::transport::{
    ActionInvocation, ActionCompletion,
    ConceptTransport, ConceptQuery,
};
use crate::storage::ConceptStorage;
use super::handler::SymbolOccurrenceHandler;
use super::types::*;

pub struct SymbolOccurrenceAdapter<H: SymbolOccurrenceHandler> {
    handler: H,
    storage: Box<dyn ConceptStorage>,
}

impl<H: SymbolOccurrenceHandler> SymbolOccurrenceAdapter<H> {
    pub fn new(handler: H, storage: Box<dyn ConceptStorage>) -> Self {
        Self { handler, storage }
    }
}

#[async_trait::async_trait]
impl<H: SymbolOccurrenceHandler + 'static> ConceptTransport for SymbolOccurrenceAdapter<H> {
    async fn invoke(&self, invocation: ActionInvocation) -> Result<ActionCompletion, Box<dyn std::error::Error>> {
        let result: Value = match invocation.action.as_str() {
            "record" => {
                let input: SymbolOccurrenceRecordInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.record(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "findDefinitions" => {
                let input: SymbolOccurrenceFindDefinitionsInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.find_definitions(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "findReferences" => {
                let input: SymbolOccurrenceFindReferencesInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.find_references(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "findAtPosition" => {
                let input: SymbolOccurrenceFindAtPositionInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.find_at_position(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "findInFile" => {
                let input: SymbolOccurrenceFindInFileInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.find_in_file(input, self.storage.as_ref()).await?;
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
