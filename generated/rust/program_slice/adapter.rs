// generated: program_slice/adapter.rs

use serde_json::Value;
use crate::transport::{
    ActionInvocation, ActionCompletion,
    ConceptTransport, ConceptQuery,
};
use crate::storage::ConceptStorage;
use super::handler::ProgramSliceHandler;
use super::types::*;

pub struct ProgramSliceAdapter<H: ProgramSliceHandler> {
    handler: H,
    storage: Box<dyn ConceptStorage>,
}

impl<H: ProgramSliceHandler> ProgramSliceAdapter<H> {
    pub fn new(handler: H, storage: Box<dyn ConceptStorage>) -> Self {
        Self { handler, storage }
    }
}

#[async_trait::async_trait]
impl<H: ProgramSliceHandler + 'static> ConceptTransport for ProgramSliceAdapter<H> {
    async fn invoke(&self, invocation: ActionInvocation) -> Result<ActionCompletion, Box<dyn std::error::Error>> {
        let result: Value = match invocation.action.as_str() {
            "compute" => {
                let input: ProgramSliceComputeInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.compute(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "filesInSlice" => {
                let input: ProgramSliceFilesInSliceInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.files_in_slice(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "symbolsInSlice" => {
                let input: ProgramSliceSymbolsInSliceInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.symbols_in_slice(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "get" => {
                let input: ProgramSliceGetInput = serde_json::from_value(invocation.input.clone())?;
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
