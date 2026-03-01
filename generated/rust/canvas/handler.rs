// generated: canvas/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait CanvasHandler: Send + Sync {
    async fn add_node(
        &self,
        input: CanvasAddNodeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<CanvasAddNodeOutput, Box<dyn std::error::Error>>;

    async fn move_node(
        &self,
        input: CanvasMoveNodeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<CanvasMoveNodeOutput, Box<dyn std::error::Error>>;

    async fn group_nodes(
        &self,
        input: CanvasGroupNodesInput,
        storage: &dyn ConceptStorage,
    ) -> Result<CanvasGroupNodesOutput, Box<dyn std::error::Error>>;

}
