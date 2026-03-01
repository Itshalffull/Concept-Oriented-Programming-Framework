// generated: score_api/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait ScoreApiHandler: Send + Sync {
    async fn list_files(
        &self,
        input: ScoreApiListFilesInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ScoreApiListFilesOutput, Box<dyn std::error::Error>>;

    async fn get_file_tree(
        &self,
        input: ScoreApiGetFileTreeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ScoreApiGetFileTreeOutput, Box<dyn std::error::Error>>;

    async fn get_file_content(
        &self,
        input: ScoreApiGetFileContentInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ScoreApiGetFileContentOutput, Box<dyn std::error::Error>>;

    async fn get_definitions(
        &self,
        input: ScoreApiGetDefinitionsInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ScoreApiGetDefinitionsOutput, Box<dyn std::error::Error>>;

    async fn match_pattern(
        &self,
        input: ScoreApiMatchPatternInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ScoreApiMatchPatternOutput, Box<dyn std::error::Error>>;

    async fn find_symbol(
        &self,
        input: ScoreApiFindSymbolInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ScoreApiFindSymbolOutput, Box<dyn std::error::Error>>;

    async fn get_references(
        &self,
        input: ScoreApiGetReferencesInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ScoreApiGetReferencesOutput, Box<dyn std::error::Error>>;

    async fn get_scope(
        &self,
        input: ScoreApiGetScopeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ScoreApiGetScopeOutput, Box<dyn std::error::Error>>;

    async fn get_relationships(
        &self,
        input: ScoreApiGetRelationshipsInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ScoreApiGetRelationshipsOutput, Box<dyn std::error::Error>>;

    async fn list_concepts(
        &self,
        input: ScoreApiListConceptsInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ScoreApiListConceptsOutput, Box<dyn std::error::Error>>;

    async fn get_concept(
        &self,
        input: ScoreApiGetConceptInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ScoreApiGetConceptOutput, Box<dyn std::error::Error>>;

    async fn get_action(
        &self,
        input: ScoreApiGetActionInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ScoreApiGetActionOutput, Box<dyn std::error::Error>>;

    async fn list_syncs(
        &self,
        input: ScoreApiListSyncsInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ScoreApiListSyncsOutput, Box<dyn std::error::Error>>;

    async fn get_sync(
        &self,
        input: ScoreApiGetSyncInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ScoreApiGetSyncOutput, Box<dyn std::error::Error>>;

    async fn get_flow(
        &self,
        input: ScoreApiGetFlowInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ScoreApiGetFlowOutput, Box<dyn std::error::Error>>;

    async fn get_dependencies(
        &self,
        input: ScoreApiGetDependenciesInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ScoreApiGetDependenciesOutput, Box<dyn std::error::Error>>;

    async fn get_dependents(
        &self,
        input: ScoreApiGetDependentsInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ScoreApiGetDependentsOutput, Box<dyn std::error::Error>>;

    async fn get_impact(
        &self,
        input: ScoreApiGetImpactInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ScoreApiGetImpactOutput, Box<dyn std::error::Error>>;

    async fn get_data_flow(
        &self,
        input: ScoreApiGetDataFlowInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ScoreApiGetDataFlowOutput, Box<dyn std::error::Error>>;

    async fn search(
        &self,
        input: ScoreApiSearchInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ScoreApiSearchOutput, Box<dyn std::error::Error>>;

    async fn explain(
        &self,
        input: ScoreApiExplainInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ScoreApiExplainOutput, Box<dyn std::error::Error>>;

    async fn status(
        &self,
        input: ScoreApiStatusInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ScoreApiStatusOutput, Box<dyn std::error::Error>>;

    async fn reindex(
        &self,
        input: ScoreApiReindexInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ScoreApiReindexOutput, Box<dyn std::error::Error>>;

}
