// generated: query/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait QueryHandler: Send + Sync {
    async fn parse(
        &self,
        input: QueryParseInput,
        storage: &dyn ConceptStorage,
    ) -> Result<QueryParseOutput, Box<dyn std::error::Error>>;

    async fn execute(
        &self,
        input: QueryExecuteInput,
        storage: &dyn ConceptStorage,
    ) -> Result<QueryExecuteOutput, Box<dyn std::error::Error>>;

    async fn subscribe(
        &self,
        input: QuerySubscribeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<QuerySubscribeOutput, Box<dyn std::error::Error>>;

    async fn add_filter(
        &self,
        input: QueryAddFilterInput,
        storage: &dyn ConceptStorage,
    ) -> Result<QueryAddFilterOutput, Box<dyn std::error::Error>>;

    async fn add_sort(
        &self,
        input: QueryAddSortInput,
        storage: &dyn ConceptStorage,
    ) -> Result<QueryAddSortOutput, Box<dyn std::error::Error>>;

    async fn set_scope(
        &self,
        input: QuerySetScopeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<QuerySetScopeOutput, Box<dyn std::error::Error>>;

}
