// generated: d_a_g_history/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait DAGHistoryHandler: Send + Sync {
    async fn append(
        &self,
        input: DAGHistoryAppendInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DAGHistoryAppendOutput, Box<dyn std::error::Error>>;

    async fn ancestors(
        &self,
        input: DAGHistoryAncestorsInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DAGHistoryAncestorsOutput, Box<dyn std::error::Error>>;

    async fn common_ancestor(
        &self,
        input: DAGHistoryCommonAncestorInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DAGHistoryCommonAncestorOutput, Box<dyn std::error::Error>>;

    async fn descendants(
        &self,
        input: DAGHistoryDescendantsInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DAGHistoryDescendantsOutput, Box<dyn std::error::Error>>;

    async fn between(
        &self,
        input: DAGHistoryBetweenInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DAGHistoryBetweenOutput, Box<dyn std::error::Error>>;

    async fn get_node(
        &self,
        input: DAGHistoryGetNodeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DAGHistoryGetNodeOutput, Box<dyn std::error::Error>>;

}
