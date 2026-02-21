// Graph Concept Implementation (Rust)
//
// Manages a graph of nodes and edges with neighbor traversal.
// See Architecture doc Sections on graph and relationship model.

use crate::storage::{ConceptStorage, StorageResult};
use serde::{Deserialize, Serialize};
use serde_json::json;

// ── AddNode ───────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AddNodeInput {
    pub entity_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum AddNodeOutput {
    #[serde(rename = "ok")]
    Ok { entity_id: String },
    #[serde(rename = "already_exists")]
    AlreadyExists { entity_id: String },
}

// ── RemoveNode ────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RemoveNodeInput {
    pub entity_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum RemoveNodeOutput {
    #[serde(rename = "ok")]
    Ok { entity_id: String },
    #[serde(rename = "notfound")]
    NotFound { message: String },
}

// ── AddEdge ───────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AddEdgeInput {
    pub source_id: String,
    pub target_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum AddEdgeOutput {
    #[serde(rename = "ok")]
    Ok {
        source_id: String,
        target_id: String,
    },
}

// ── RemoveEdge ────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RemoveEdgeInput {
    pub source_id: String,
    pub target_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum RemoveEdgeOutput {
    #[serde(rename = "ok")]
    Ok {
        source_id: String,
        target_id: String,
    },
    #[serde(rename = "notfound")]
    NotFound { message: String },
}

// ── GetNeighbors ──────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetNeighborsInput {
    pub entity_id: String,
    pub depth: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum GetNeighborsOutput {
    #[serde(rename = "ok")]
    Ok {
        entity_id: String,
        neighbors: String,
    },
}

// ── Handler ───────────────────────────────────────────────

pub struct GraphHandler;

impl GraphHandler {
    pub async fn add_node(
        &self,
        input: AddNodeInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<AddNodeOutput> {
        let existing = storage.get("graph_node", &input.entity_id).await?;

        if existing.is_some() {
            return Ok(AddNodeOutput::AlreadyExists {
                entity_id: input.entity_id,
            });
        }

        storage
            .put(
                "graph_node",
                &input.entity_id,
                json!({ "entity_id": input.entity_id }),
            )
            .await?;

        Ok(AddNodeOutput::Ok {
            entity_id: input.entity_id,
        })
    }

    pub async fn remove_node(
        &self,
        input: RemoveNodeInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<RemoveNodeOutput> {
        let existing = storage.get("graph_node", &input.entity_id).await?;

        if existing.is_none() {
            return Ok(RemoveNodeOutput::NotFound {
                message: format!("Graph node '{}' not found", input.entity_id),
            });
        }

        storage.del("graph_node", &input.entity_id).await?;

        // Also remove edges involving this node
        let all_edges = storage.find("graph_edge", None).await?;
        for edge in all_edges {
            let source = edge["source_id"].as_str().unwrap_or("");
            let target = edge["target_id"].as_str().unwrap_or("");
            if source == input.entity_id || target == input.entity_id {
                let edge_key = format!("{}:{}", source, target);
                storage.del("graph_edge", &edge_key).await?;
            }
        }

        Ok(RemoveNodeOutput::Ok {
            entity_id: input.entity_id,
        })
    }

    pub async fn add_edge(
        &self,
        input: AddEdgeInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<AddEdgeOutput> {
        let edge_key = format!("{}:{}", input.source_id, input.target_id);

        storage
            .put(
                "graph_edge",
                &edge_key,
                json!({
                    "source_id": input.source_id,
                    "target_id": input.target_id,
                }),
            )
            .await?;

        Ok(AddEdgeOutput::Ok {
            source_id: input.source_id,
            target_id: input.target_id,
        })
    }

    pub async fn remove_edge(
        &self,
        input: RemoveEdgeInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<RemoveEdgeOutput> {
        let edge_key = format!("{}:{}", input.source_id, input.target_id);
        let existing = storage.get("graph_edge", &edge_key).await?;

        if existing.is_none() {
            return Ok(RemoveEdgeOutput::NotFound {
                message: format!(
                    "Edge from '{}' to '{}' not found",
                    input.source_id, input.target_id
                ),
            });
        }

        storage.del("graph_edge", &edge_key).await?;

        Ok(RemoveEdgeOutput::Ok {
            source_id: input.source_id,
            target_id: input.target_id,
        })
    }

    pub async fn get_neighbors(
        &self,
        input: GetNeighborsInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<GetNeighborsOutput> {
        let all_edges = storage.find("graph_edge", None).await?;

        let mut visited: Vec<String> = vec![];
        let mut frontier: Vec<String> = vec![input.entity_id.clone()];

        for _ in 0..input.depth {
            let mut next_frontier: Vec<String> = vec![];
            for node in &frontier {
                for edge in &all_edges {
                    let source = edge["source_id"].as_str().unwrap_or("");
                    let target = edge["target_id"].as_str().unwrap_or("");

                    if source == node && !visited.contains(&target.to_string()) && target != input.entity_id {
                        visited.push(target.to_string());
                        next_frontier.push(target.to_string());
                    }
                    if target == node && !visited.contains(&source.to_string()) && source != input.entity_id {
                        visited.push(source.to_string());
                        next_frontier.push(source.to_string());
                    }
                }
            }
            frontier = next_frontier;
            if frontier.is_empty() {
                break;
            }
        }

        Ok(GetNeighborsOutput::Ok {
            entity_id: input.entity_id,
            neighbors: serde_json::to_string(&visited)?,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn add_node() {
        let storage = InMemoryStorage::new();
        let handler = GraphHandler;
        let result = handler
            .add_node(AddNodeInput { entity_id: "n1".into() }, &storage)
            .await
            .unwrap();
        match result {
            AddNodeOutput::Ok { entity_id } => assert_eq!(entity_id, "n1"),
            AddNodeOutput::AlreadyExists { .. } => panic!("expected Ok"),
        }
    }

    #[tokio::test]
    async fn add_node_already_exists() {
        let storage = InMemoryStorage::new();
        let handler = GraphHandler;
        handler.add_node(AddNodeInput { entity_id: "n1".into() }, &storage).await.unwrap();
        let result = handler
            .add_node(AddNodeInput { entity_id: "n1".into() }, &storage)
            .await
            .unwrap();
        assert!(matches!(result, AddNodeOutput::AlreadyExists { .. }));
    }

    #[tokio::test]
    async fn remove_node() {
        let storage = InMemoryStorage::new();
        let handler = GraphHandler;
        handler.add_node(AddNodeInput { entity_id: "n1".into() }, &storage).await.unwrap();
        let result = handler
            .remove_node(RemoveNodeInput { entity_id: "n1".into() }, &storage)
            .await
            .unwrap();
        match result {
            RemoveNodeOutput::Ok { entity_id } => assert_eq!(entity_id, "n1"),
            RemoveNodeOutput::NotFound { .. } => panic!("expected Ok"),
        }
    }

    #[tokio::test]
    async fn remove_node_not_found() {
        let storage = InMemoryStorage::new();
        let handler = GraphHandler;
        let result = handler
            .remove_node(RemoveNodeInput { entity_id: "missing".into() }, &storage)
            .await
            .unwrap();
        assert!(matches!(result, RemoveNodeOutput::NotFound { .. }));
    }

    #[tokio::test]
    async fn add_and_remove_edge() {
        let storage = InMemoryStorage::new();
        let handler = GraphHandler;
        let result = handler
            .add_edge(
                AddEdgeInput { source_id: "a".into(), target_id: "b".into() },
                &storage,
            )
            .await
            .unwrap();
        match result {
            AddEdgeOutput::Ok { source_id, target_id } => {
                assert_eq!(source_id, "a");
                assert_eq!(target_id, "b");
            }
        }

        let rm_result = handler
            .remove_edge(
                RemoveEdgeInput { source_id: "a".into(), target_id: "b".into() },
                &storage,
            )
            .await
            .unwrap();
        assert!(matches!(rm_result, RemoveEdgeOutput::Ok { .. }));
    }

    #[tokio::test]
    async fn remove_edge_not_found() {
        let storage = InMemoryStorage::new();
        let handler = GraphHandler;
        let result = handler
            .remove_edge(
                RemoveEdgeInput { source_id: "x".into(), target_id: "y".into() },
                &storage,
            )
            .await
            .unwrap();
        assert!(matches!(result, RemoveEdgeOutput::NotFound { .. }));
    }

    #[tokio::test]
    async fn get_neighbors_depth_one() {
        let storage = InMemoryStorage::new();
        let handler = GraphHandler;
        handler.add_node(AddNodeInput { entity_id: "a".into() }, &storage).await.unwrap();
        handler.add_node(AddNodeInput { entity_id: "b".into() }, &storage).await.unwrap();
        handler.add_node(AddNodeInput { entity_id: "c".into() }, &storage).await.unwrap();
        handler
            .add_edge(AddEdgeInput { source_id: "a".into(), target_id: "b".into() }, &storage)
            .await
            .unwrap();
        handler
            .add_edge(AddEdgeInput { source_id: "a".into(), target_id: "c".into() }, &storage)
            .await
            .unwrap();

        let result = handler
            .get_neighbors(
                GetNeighborsInput { entity_id: "a".into(), depth: 1 },
                &storage,
            )
            .await
            .unwrap();
        match result {
            GetNeighborsOutput::Ok { entity_id, neighbors } => {
                assert_eq!(entity_id, "a");
                let parsed: Vec<String> = serde_json::from_str(&neighbors).unwrap();
                assert_eq!(parsed.len(), 2);
                assert!(parsed.contains(&"b".to_string()));
                assert!(parsed.contains(&"c".to_string()));
            }
        }
    }
}
