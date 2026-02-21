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
