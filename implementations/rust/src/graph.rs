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
