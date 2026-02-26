// generated: search_index/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait SearchIndexHandler: Send + Sync {
    async fn create_index(
        &self,
        input: SearchIndexCreateIndexInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SearchIndexCreateIndexOutput, Box<dyn std::error::Error>>;

    async fn index_item(
        &self,
        input: SearchIndexIndexItemInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SearchIndexIndexItemOutput, Box<dyn std::error::Error>>;

    async fn remove_item(
        &self,
        input: SearchIndexRemoveItemInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SearchIndexRemoveItemOutput, Box<dyn std::error::Error>>;

    async fn search(
        &self,
        input: SearchIndexSearchInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SearchIndexSearchOutput, Box<dyn std::error::Error>>;

    async fn add_processor(
        &self,
        input: SearchIndexAddProcessorInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SearchIndexAddProcessorOutput, Box<dyn std::error::Error>>;

    async fn reindex(
        &self,
        input: SearchIndexReindexInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SearchIndexReindexOutput, Box<dyn std::error::Error>>;

}
