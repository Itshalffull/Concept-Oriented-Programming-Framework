// generated: graph/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait GraphHandler: Send + Sync {
    async fn add_node(
        &self,
        input: GraphAddNodeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<GraphAddNodeOutput, Box<dyn std::error::Error>>;

    async fn remove_node(
        &self,
        input: GraphRemoveNodeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<GraphRemoveNodeOutput, Box<dyn std::error::Error>>;

    async fn add_edge(
        &self,
        input: GraphAddEdgeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<GraphAddEdgeOutput, Box<dyn std::error::Error>>;

    async fn remove_edge(
        &self,
        input: GraphRemoveEdgeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<GraphRemoveEdgeOutput, Box<dyn std::error::Error>>;

    async fn compute_layout(
        &self,
        input: GraphComputeLayoutInput,
        storage: &dyn ConceptStorage,
    ) -> Result<GraphComputeLayoutOutput, Box<dyn std::error::Error>>;

    async fn get_neighbors(
        &self,
        input: GraphGetNeighborsInput,
        storage: &dyn ConceptStorage,
    ) -> Result<GraphGetNeighborsOutput, Box<dyn std::error::Error>>;

    async fn filter_nodes(
        &self,
        input: GraphFilterNodesInput,
        storage: &dyn ConceptStorage,
    ) -> Result<GraphFilterNodesOutput, Box<dyn std::error::Error>>;

}
