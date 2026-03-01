// generated: score_api/adapter.rs

use serde_json::Value;
use crate::transport::{
    ActionInvocation, ActionCompletion,
    ConceptTransport, ConceptQuery,
};
use crate::storage::ConceptStorage;
use super::handler::ScoreApiHandler;
use super::types::*;

pub struct ScoreApiAdapter<H: ScoreApiHandler> {
    handler: H,
    storage: Box<dyn ConceptStorage>,
}

impl<H: ScoreApiHandler> ScoreApiAdapter<H> {
    pub fn new(handler: H, storage: Box<dyn ConceptStorage>) -> Self {
        Self { handler, storage }
    }
}

#[async_trait::async_trait]
impl<H: ScoreApiHandler + 'static> ConceptTransport for ScoreApiAdapter<H> {
    async fn invoke(&self, invocation: ActionInvocation) -> Result<ActionCompletion, Box<dyn std::error::Error>> {
        let result: Value = match invocation.action.as_str() {
            "listFiles" => {
                let input: ScoreApiListFilesInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.list_files(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "getFileTree" => {
                let input: ScoreApiGetFileTreeInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.get_file_tree(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "getFileContent" => {
                let input: ScoreApiGetFileContentInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.get_file_content(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "getDefinitions" => {
                let input: ScoreApiGetDefinitionsInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.get_definitions(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "matchPattern" => {
                let input: ScoreApiMatchPatternInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.match_pattern(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "findSymbol" => {
                let input: ScoreApiFindSymbolInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.find_symbol(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "getReferences" => {
                let input: ScoreApiGetReferencesInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.get_references(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "getScope" => {
                let input: ScoreApiGetScopeInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.get_scope(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "getRelationships" => {
                let input: ScoreApiGetRelationshipsInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.get_relationships(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "listConcepts" => {
                let input: ScoreApiListConceptsInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.list_concepts(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "getConcept" => {
                let input: ScoreApiGetConceptInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.get_concept(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "getAction" => {
                let input: ScoreApiGetActionInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.get_action(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "listSyncs" => {
                let input: ScoreApiListSyncsInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.list_syncs(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "getSync" => {
                let input: ScoreApiGetSyncInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.get_sync(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "getFlow" => {
                let input: ScoreApiGetFlowInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.get_flow(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "getDependencies" => {
                let input: ScoreApiGetDependenciesInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.get_dependencies(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "getDependents" => {
                let input: ScoreApiGetDependentsInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.get_dependents(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "getImpact" => {
                let input: ScoreApiGetImpactInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.get_impact(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "getDataFlow" => {
                let input: ScoreApiGetDataFlowInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.get_data_flow(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "search" => {
                let input: ScoreApiSearchInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.search(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "explain" => {
                let input: ScoreApiExplainInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.explain(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "status" => {
                let input: ScoreApiStatusInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.status(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "reindex" => {
                let input: ScoreApiReindexInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.reindex(input, self.storage.as_ref()).await?;
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
