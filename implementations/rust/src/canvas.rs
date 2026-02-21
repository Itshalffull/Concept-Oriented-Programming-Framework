// Canvas Concept Implementation (Rust)
//
// Manages a canvas with positioned nodes, edges, and grouping.
// See Architecture doc Sections on canvas and spatial layout.

use crate::storage::{ConceptStorage, StorageResult};
use serde::{Deserialize, Serialize};
use serde_json::json;

// ── AddNode ───────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AddNodeInput {
    pub node_type: String,
    pub position_x: f64,
    pub position_y: f64,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum AddNodeOutput {
    #[serde(rename = "ok")]
    Ok { node_id: String },
}

// ── MoveNode ──────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MoveNodeInput {
    pub node_id: String,
    pub new_x: f64,
    pub new_y: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum MoveNodeOutput {
    #[serde(rename = "ok")]
    Ok { node_id: String },
    #[serde(rename = "notfound")]
    NotFound { message: String },
}

// ── ConnectNodes ──────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectNodesInput {
    pub from_id: String,
    pub to_id: String,
    pub label: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum ConnectNodesOutput {
    #[serde(rename = "ok")]
    Ok { edge_id: String },
}

// ── GroupNodes ─────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GroupNodesInput {
    pub node_ids: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum GroupNodesOutput {
    #[serde(rename = "ok")]
    Ok { group_id: String },
}

// ── Handler ───────────────────────────────────────────────

pub struct CanvasHandler;

impl CanvasHandler {
    pub async fn add_node(
        &self,
        input: AddNodeInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<AddNodeOutput> {
        let node_id = format!(
            "cnode_{}_{}",
            input.node_type,
            chrono::Utc::now().timestamp_millis()
        );

        storage
            .put(
                "canvas_node",
                &node_id,
                json!({
                    "node_id": node_id,
                    "node_type": input.node_type,
                    "position_x": input.position_x,
                    "position_y": input.position_y,
                    "content": input.content,
                    "group_id": null,
                }),
            )
            .await?;

        Ok(AddNodeOutput::Ok { node_id })
    }

    pub async fn move_node(
        &self,
        input: MoveNodeInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<MoveNodeOutput> {
        let existing = storage.get("canvas_node", &input.node_id).await?;

        match existing {
            None => Ok(MoveNodeOutput::NotFound {
                message: format!("Canvas node '{}' not found", input.node_id),
            }),
            Some(mut node) => {
                node["position_x"] = json!(input.new_x);
                node["position_y"] = json!(input.new_y);
                storage.put("canvas_node", &input.node_id, node).await?;

                Ok(MoveNodeOutput::Ok {
                    node_id: input.node_id,
                })
            }
        }
    }

    pub async fn connect_nodes(
        &self,
        input: ConnectNodesInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<ConnectNodesOutput> {
        let edge_id = format!(
            "cedge_{}_{}",
            input.from_id,
            chrono::Utc::now().timestamp_millis()
        );

        storage
            .put(
                "canvas_edge",
                &edge_id,
                json!({
                    "edge_id": edge_id,
                    "from_id": input.from_id,
                    "to_id": input.to_id,
                    "label": input.label,
                }),
            )
            .await?;

        Ok(ConnectNodesOutput::Ok { edge_id })
    }

    pub async fn group_nodes(
        &self,
        input: GroupNodesInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<GroupNodesOutput> {
        let node_ids: Vec<String> =
            serde_json::from_str(&input.node_ids).unwrap_or_default();

        let group_id = format!(
            "cgroup_{}",
            chrono::Utc::now().timestamp_millis()
        );

        // Update each node with the group_id
        for node_id in &node_ids {
            let existing = storage.get("canvas_node", node_id).await?;
            if let Some(mut node) = existing {
                node["group_id"] = json!(group_id);
                storage.put("canvas_node", node_id, node).await?;
            }
        }

        // Store the group definition
        storage
            .put(
                "canvas_node",
                &group_id,
                json!({
                    "node_id": group_id,
                    "node_type": "group",
                    "node_ids": node_ids,
                    "position_x": 0.0,
                    "position_y": 0.0,
                    "content": "",
                    "group_id": null,
                }),
            )
            .await?;

        Ok(GroupNodesOutput::Ok { group_id })
    }
}

// ── Tests ──────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    // --- add_node ---

    #[tokio::test]
    async fn add_node_creates_canvas_node() {
        let storage = InMemoryStorage::new();
        let handler = CanvasHandler;

        let result = handler
            .add_node(
                AddNodeInput {
                    node_type: "text".into(),
                    position_x: 10.0,
                    position_y: 20.0,
                    content: "Hello".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        match result {
            AddNodeOutput::Ok { node_id } => {
                assert!(node_id.starts_with("cnode_text_"));
                let record = storage.get("canvas_node", &node_id).await.unwrap();
                assert!(record.is_some());
            }
        }
    }

    #[tokio::test]
    async fn add_node_stores_position() {
        let storage = InMemoryStorage::new();
        let handler = CanvasHandler;

        let result = handler
            .add_node(
                AddNodeInput {
                    node_type: "image".into(),
                    position_x: 100.5,
                    position_y: 200.7,
                    content: "img.png".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        match result {
            AddNodeOutput::Ok { node_id } => {
                let record = storage.get("canvas_node", &node_id).await.unwrap().unwrap();
                assert_eq!(record["position_x"].as_f64().unwrap(), 100.5);
                assert_eq!(record["position_y"].as_f64().unwrap(), 200.7);
            }
        }
    }

    // --- move_node ---

    #[tokio::test]
    async fn move_node_updates_position() {
        let storage = InMemoryStorage::new();
        let handler = CanvasHandler;

        let add_result = handler
            .add_node(
                AddNodeInput {
                    node_type: "text".into(),
                    position_x: 0.0,
                    position_y: 0.0,
                    content: "movable".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        let node_id = match add_result {
            AddNodeOutput::Ok { node_id } => node_id,
        };

        let result = handler
            .move_node(
                MoveNodeInput {
                    node_id: node_id.clone(),
                    new_x: 50.0,
                    new_y: 75.0,
                },
                &storage,
            )
            .await
            .unwrap();

        assert!(matches!(result, MoveNodeOutput::Ok { .. }));

        let record = storage.get("canvas_node", &node_id).await.unwrap().unwrap();
        assert_eq!(record["position_x"].as_f64().unwrap(), 50.0);
        assert_eq!(record["position_y"].as_f64().unwrap(), 75.0);
    }

    #[tokio::test]
    async fn move_node_not_found() {
        let storage = InMemoryStorage::new();
        let handler = CanvasHandler;

        let result = handler
            .move_node(
                MoveNodeInput {
                    node_id: "nonexistent".into(),
                    new_x: 1.0,
                    new_y: 2.0,
                },
                &storage,
            )
            .await
            .unwrap();

        assert!(matches!(result, MoveNodeOutput::NotFound { .. }));
    }

    // --- connect_nodes ---

    #[tokio::test]
    async fn connect_nodes_creates_edge() {
        let storage = InMemoryStorage::new();
        let handler = CanvasHandler;

        let result = handler
            .connect_nodes(
                ConnectNodesInput {
                    from_id: "n1".into(),
                    to_id: "n2".into(),
                    label: "depends_on".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        match result {
            ConnectNodesOutput::Ok { edge_id } => {
                assert!(edge_id.starts_with("cedge_n1_"));
                let record = storage.get("canvas_edge", &edge_id).await.unwrap();
                assert!(record.is_some());
            }
        }
    }

    #[tokio::test]
    async fn connect_nodes_stores_label() {
        let storage = InMemoryStorage::new();
        let handler = CanvasHandler;

        let result = handler
            .connect_nodes(
                ConnectNodesInput {
                    from_id: "a".into(),
                    to_id: "b".into(),
                    label: "flow".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        match result {
            ConnectNodesOutput::Ok { edge_id } => {
                let record = storage.get("canvas_edge", &edge_id).await.unwrap().unwrap();
                assert_eq!(record["label"].as_str().unwrap(), "flow");
            }
        }
    }

    // --- group_nodes ---

    #[tokio::test]
    async fn group_nodes_creates_group() {
        let storage = InMemoryStorage::new();
        let handler = CanvasHandler;

        // Add two nodes first
        let r1 = handler
            .add_node(
                AddNodeInput {
                    node_type: "text".into(),
                    position_x: 0.0,
                    position_y: 0.0,
                    content: "a".into(),
                },
                &storage,
            )
            .await
            .unwrap();
        let n1 = match r1 { AddNodeOutput::Ok { node_id } => node_id };

        let r2 = handler
            .add_node(
                AddNodeInput {
                    node_type: "text".into(),
                    position_x: 10.0,
                    position_y: 10.0,
                    content: "b".into(),
                },
                &storage,
            )
            .await
            .unwrap();
        let n2 = match r2 { AddNodeOutput::Ok { node_id } => node_id };

        let node_ids_json = serde_json::to_string(&vec![&n1, &n2]).unwrap();

        let result = handler
            .group_nodes(
                GroupNodesInput { node_ids: node_ids_json },
                &storage,
            )
            .await
            .unwrap();

        match result {
            GroupNodesOutput::Ok { group_id } => {
                assert!(group_id.starts_with("cgroup_"));
            }
        }
    }

    #[tokio::test]
    async fn group_nodes_with_empty_list() {
        let storage = InMemoryStorage::new();
        let handler = CanvasHandler;

        let result = handler
            .group_nodes(
                GroupNodesInput { node_ids: "[]".into() },
                &storage,
            )
            .await
            .unwrap();

        assert!(matches!(result, GroupNodesOutput::Ok { .. }));
    }
}
