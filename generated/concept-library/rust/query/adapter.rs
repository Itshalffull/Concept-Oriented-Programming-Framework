// generated: query/adapter.rs

use serde_json::Value;
use crate::transport::{
    ActionInvocation, ActionCompletion,
    ConceptTransport, ConceptQuery,
};
use crate::storage::ConceptStorage;
use super::handler::QueryHandler;
use super::types::*;

pub struct QueryAdapter<H: QueryHandler> {
    handler: H,
    storage: Box<dyn ConceptStorage>,
}

impl<H: QueryHandler> QueryAdapter<H> {
    pub fn new(handler: H, storage: Box<dyn ConceptStorage>) -> Self {
        Self { handler, storage }
    }
}

#[async_trait::async_trait]
impl<H: QueryHandler + 'static> ConceptTransport for QueryAdapter<H> {
    async fn invoke(&self, invocation: ActionInvocation) -> Result<ActionCompletion, Box<dyn std::error::Error>> {
        let result: Value = match invocation.action.as_str() {
            "parse" => {
                let input: QueryParseInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.parse(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "execute" => {
                let input: QueryExecuteInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.execute(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "subscribe" => {
                let input: QuerySubscribeInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.subscribe(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "addFilter" => {
                let input: QueryAddFilterInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.add_filter(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "addSort" => {
                let input: QueryAddSortInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.add_sort(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "setScope" => {
                let input: QuerySetScopeInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.set_scope(input, self.storage.as_ref()).await?;
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
