// GraphTraversalAnalysisProvider concept implementation
// Registers and initializes a graph traversal analysis engine provider instance.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::GraphTraversalAnalysisProviderHandler;
use serde_json::json;
use chrono::Utc;

pub struct GraphTraversalAnalysisProviderHandlerImpl;

#[async_trait]
impl GraphTraversalAnalysisProviderHandler for GraphTraversalAnalysisProviderHandlerImpl {
    async fn initialize(
        &self,
        _input: GraphTraversalAnalysisProviderInitializeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<GraphTraversalAnalysisProviderInitializeOutput, Box<dyn std::error::Error>> {
        let instance_id = format!("graph-analysis-{}", Utc::now().timestamp_millis());

        // Check if engine dependencies are available
        let engine_check = storage.get("engine", "graph-traversal").await?;

        if engine_check.is_none() {
            // Register the engine provider
            storage.put("engine", "graph-traversal", json!({
                "engine": "graph-traversal",
                "instance": instance_id,
                "capabilities": ["bfs", "dfs", "shortest-path", "cycle-detection", "topological-sort"],
                "status": "initialized",
                "initializedAt": Utc::now().to_rfc3339(),
            })).await?;
        }

        // Register this provider instance
        storage.put("provider", &instance_id, json!({
            "instance": instance_id,
            "engine": "graph-traversal",
            "status": "ready",
            "algorithms": [
                "breadth-first-search",
                "depth-first-search",
                "dijkstra",
                "bellman-ford",
                "tarjan-scc",
                "kahn-topological"
            ],
            "initializedAt": Utc::now().to_rfc3339(),
        })).await?;

        Ok(GraphTraversalAnalysisProviderInitializeOutput::Ok {
            instance: instance_id,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_initialize_success() {
        let storage = InMemoryStorage::new();
        let handler = GraphTraversalAnalysisProviderHandlerImpl;
        let result = handler.initialize(
            GraphTraversalAnalysisProviderInitializeInput {},
            &storage,
        ).await.unwrap();
        match result {
            GraphTraversalAnalysisProviderInitializeOutput::Ok { instance } => {
                assert!(instance.starts_with("graph-analysis-"));
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_initialize_idempotent() {
        let storage = InMemoryStorage::new();
        let handler = GraphTraversalAnalysisProviderHandlerImpl;
        let result1 = handler.initialize(
            GraphTraversalAnalysisProviderInitializeInput {},
            &storage,
        ).await.unwrap();
        let result2 = handler.initialize(
            GraphTraversalAnalysisProviderInitializeInput {},
            &storage,
        ).await.unwrap();
        match (result1, result2) {
            (GraphTraversalAnalysisProviderInitializeOutput::Ok { .. },
             GraphTraversalAnalysisProviderInitializeOutput::Ok { .. }) => {},
            _ => panic!("Expected both calls to return Ok"),
        }
    }
}
