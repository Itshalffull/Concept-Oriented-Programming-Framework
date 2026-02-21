// Outline Concept Implementation (Rust)
//
// Hierarchical outline operations — indent, outdent, move, reparent,
// collapse, expand, and zoom into subtrees.

use crate::storage::{ConceptStorage, StorageResult};
use serde::{Deserialize, Serialize};
use serde_json::json;

// --- Indent ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IndentInput {
    pub node_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum IndentOutput {
    #[serde(rename = "ok")]
    Ok { node_id: String },
    #[serde(rename = "notfound")]
    NotFound { message: String },
}

// --- Outdent ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OutdentInput {
    pub node_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum OutdentOutput {
    #[serde(rename = "ok")]
    Ok { node_id: String },
    #[serde(rename = "notfound")]
    NotFound { message: String },
}

// --- MoveUp ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MoveUpInput {
    pub node_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum MoveUpOutput {
    #[serde(rename = "ok")]
    Ok { node_id: String },
    #[serde(rename = "notfound")]
    NotFound { message: String },
}

// --- MoveDown ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MoveDownInput {
    pub node_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum MoveDownOutput {
    #[serde(rename = "ok")]
    Ok { node_id: String },
    #[serde(rename = "notfound")]
    NotFound { message: String },
}

// --- Reparent ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReparentInput {
    pub node_id: String,
    pub new_parent_id: String,
    pub position: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum ReparentOutput {
    #[serde(rename = "ok")]
    Ok { node_id: String },
}

// --- Collapse ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CollapseInput {
    pub node_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum CollapseOutput {
    #[serde(rename = "ok")]
    Ok { node_id: String },
    #[serde(rename = "notfound")]
    NotFound { message: String },
}

// --- Expand ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExpandInput {
    pub node_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum ExpandOutput {
    #[serde(rename = "ok")]
    Ok { node_id: String },
    #[serde(rename = "notfound")]
    NotFound { message: String },
}

// --- Zoom ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ZoomInput {
    pub node_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum ZoomOutput {
    #[serde(rename = "ok")]
    Ok { node_id: String, children: String },
    #[serde(rename = "notfound")]
    NotFound { message: String },
}

pub struct OutlineHandler;

impl OutlineHandler {
    pub async fn indent(
        &self,
        input: IndentInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<IndentOutput> {
        let existing = storage.get("outline_node", &input.node_id).await?;
        match existing {
            None => Ok(IndentOutput::NotFound {
                message: format!("outline node '{}' not found", input.node_id),
            }),
            Some(mut node) => {
                let current_depth = node["depth"].as_u64().unwrap_or(0);
                node["depth"] = json!(current_depth + 1);
                // Make child of previous sibling by increasing depth
                if let Some(parent_id) = node.get("parent_id").and_then(|v| v.as_str()) {
                    // Find siblings under same parent to get the previous sibling
                    let siblings = storage
                        .find("outline_node", Some(&json!({ "parent_id": parent_id })))
                        .await?;
                    // Use first sibling found as new parent if available
                    for sibling in &siblings {
                        if let Some(sid) = sibling.get("node_id").and_then(|v| v.as_str()) {
                            if sid != input.node_id {
                                node["parent_id"] = json!(sid);
                                break;
                            }
                        }
                    }
                }
                node["updated_at"] = json!(chrono::Utc::now().to_rfc3339());
                storage.put("outline_node", &input.node_id, node).await?;
                Ok(IndentOutput::Ok {
                    node_id: input.node_id,
                })
            }
        }
    }

    pub async fn outdent(
        &self,
        input: OutdentInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<OutdentOutput> {
        let existing = storage.get("outline_node", &input.node_id).await?;
        match existing {
            None => Ok(OutdentOutput::NotFound {
                message: format!("outline node '{}' not found", input.node_id),
            }),
            Some(mut node) => {
                let current_depth = node["depth"].as_u64().unwrap_or(0);
                if current_depth > 0 {
                    node["depth"] = json!(current_depth - 1);
                }
                // Move to parent's parent
                if let Some(parent_id) = node.get("parent_id").and_then(|v| v.as_str()).map(|s| s.to_string()) {
                    let parent = storage.get("outline_node", &parent_id).await?;
                    if let Some(parent_node) = parent {
                        let grandparent_id = parent_node
                            .get("parent_id")
                            .and_then(|v| v.as_str())
                            .unwrap_or("");
                        node["parent_id"] = json!(grandparent_id);
                    }
                }
                node["updated_at"] = json!(chrono::Utc::now().to_rfc3339());
                storage.put("outline_node", &input.node_id, node).await?;
                Ok(OutdentOutput::Ok {
                    node_id: input.node_id,
                })
            }
        }
    }

    pub async fn move_up(
        &self,
        input: MoveUpInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<MoveUpOutput> {
        let existing = storage.get("outline_node", &input.node_id).await?;
        match existing {
            None => Ok(MoveUpOutput::NotFound {
                message: format!("outline node '{}' not found", input.node_id),
            }),
            Some(mut node) => {
                let current_position = node["position"].as_u64().unwrap_or(0);
                if current_position > 0 {
                    node["position"] = json!(current_position - 1);
                }
                node["updated_at"] = json!(chrono::Utc::now().to_rfc3339());
                storage.put("outline_node", &input.node_id, node).await?;
                Ok(MoveUpOutput::Ok {
                    node_id: input.node_id,
                })
            }
        }
    }

    pub async fn move_down(
        &self,
        input: MoveDownInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<MoveDownOutput> {
        let existing = storage.get("outline_node", &input.node_id).await?;
        match existing {
            None => Ok(MoveDownOutput::NotFound {
                message: format!("outline node '{}' not found", input.node_id),
            }),
            Some(mut node) => {
                let current_position = node["position"].as_u64().unwrap_or(0);
                node["position"] = json!(current_position + 1);
                node["updated_at"] = json!(chrono::Utc::now().to_rfc3339());
                storage.put("outline_node", &input.node_id, node).await?;
                Ok(MoveDownOutput::Ok {
                    node_id: input.node_id,
                })
            }
        }
    }

    pub async fn reparent(
        &self,
        input: ReparentInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<ReparentOutput> {
        let existing = storage.get("outline_node", &input.node_id).await?;
        let mut node = match existing {
            Some(n) => n,
            None => {
                // Create a new outline node if it doesn't exist
                json!({
                    "node_id": input.node_id,
                    "depth": 0,
                })
            }
        };
        node["parent_id"] = json!(input.new_parent_id);
        node["position"] = json!(input.position);
        node["updated_at"] = json!(chrono::Utc::now().to_rfc3339());
        storage.put("outline_node", &input.node_id, node).await?;
        Ok(ReparentOutput::Ok {
            node_id: input.node_id,
        })
    }

    pub async fn collapse(
        &self,
        input: CollapseInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<CollapseOutput> {
        let existing = storage.get("outline_node", &input.node_id).await?;
        match existing {
            None => Ok(CollapseOutput::NotFound {
                message: format!("outline node '{}' not found", input.node_id),
            }),
            Some(mut node) => {
                node["collapsed"] = json!(true);
                node["updated_at"] = json!(chrono::Utc::now().to_rfc3339());
                storage.put("outline_node", &input.node_id, node).await?;
                Ok(CollapseOutput::Ok {
                    node_id: input.node_id,
                })
            }
        }
    }

    pub async fn expand(
        &self,
        input: ExpandInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<ExpandOutput> {
        let existing = storage.get("outline_node", &input.node_id).await?;
        match existing {
            None => Ok(ExpandOutput::NotFound {
                message: format!("outline node '{}' not found", input.node_id),
            }),
            Some(mut node) => {
                node["collapsed"] = json!(false);
                node["updated_at"] = json!(chrono::Utc::now().to_rfc3339());
                storage.put("outline_node", &input.node_id, node).await?;
                Ok(ExpandOutput::Ok {
                    node_id: input.node_id,
                })
            }
        }
    }

    pub async fn zoom(
        &self,
        input: ZoomInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<ZoomOutput> {
        let existing = storage.get("outline_node", &input.node_id).await?;
        match existing {
            None => Ok(ZoomOutput::NotFound {
                message: format!("outline node '{}' not found", input.node_id),
            }),
            Some(_node) => {
                let children = storage
                    .find(
                        "outline_node",
                        Some(&json!({ "parent_id": input.node_id })),
                    )
                    .await?;
                let children_json = serde_json::to_string(&children)?;
                Ok(ZoomOutput::Ok {
                    node_id: input.node_id,
                    children: children_json,
                })
            }
        }
    }
}
