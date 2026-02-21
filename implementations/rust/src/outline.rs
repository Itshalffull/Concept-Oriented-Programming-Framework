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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;
    use serde_json::json;

    /// Helper to create an outline node in storage.
    async fn seed_node(storage: &InMemoryStorage, node_id: &str, parent_id: &str, depth: u64, position: u64) {
        storage
            .put(
                "outline_node",
                node_id,
                json!({
                    "node_id": node_id,
                    "parent_id": parent_id,
                    "depth": depth,
                    "position": position,
                    "collapsed": false,
                }),
            )
            .await
            .unwrap();
    }

    #[tokio::test]
    async fn indent_existing_node() {
        let storage = InMemoryStorage::new();
        let handler = OutlineHandler;
        seed_node(&storage, "n1", "root", 0, 0).await;

        let result = handler
            .indent(IndentInput { node_id: "n1".into() }, &storage)
            .await
            .unwrap();
        match result {
            IndentOutput::Ok { node_id } => assert_eq!(node_id, "n1"),
            IndentOutput::NotFound { .. } => panic!("expected Ok"),
        }
    }

    #[tokio::test]
    async fn indent_not_found() {
        let storage = InMemoryStorage::new();
        let handler = OutlineHandler;
        let result = handler
            .indent(IndentInput { node_id: "missing".into() }, &storage)
            .await
            .unwrap();
        assert!(matches!(result, IndentOutput::NotFound { .. }));
    }

    #[tokio::test]
    async fn outdent_existing_node() {
        let storage = InMemoryStorage::new();
        let handler = OutlineHandler;
        seed_node(&storage, "parent", "root", 0, 0).await;
        seed_node(&storage, "child", "parent", 1, 0).await;

        let result = handler
            .outdent(OutdentInput { node_id: "child".into() }, &storage)
            .await
            .unwrap();
        match result {
            OutdentOutput::Ok { node_id } => assert_eq!(node_id, "child"),
            OutdentOutput::NotFound { .. } => panic!("expected Ok"),
        }
    }

    #[tokio::test]
    async fn outdent_not_found() {
        let storage = InMemoryStorage::new();
        let handler = OutlineHandler;
        let result = handler
            .outdent(OutdentInput { node_id: "missing".into() }, &storage)
            .await
            .unwrap();
        assert!(matches!(result, OutdentOutput::NotFound { .. }));
    }

    #[tokio::test]
    async fn move_up_existing_node() {
        let storage = InMemoryStorage::new();
        let handler = OutlineHandler;
        seed_node(&storage, "n1", "root", 0, 2).await;

        let result = handler
            .move_up(MoveUpInput { node_id: "n1".into() }, &storage)
            .await
            .unwrap();
        match result {
            MoveUpOutput::Ok { node_id } => assert_eq!(node_id, "n1"),
            MoveUpOutput::NotFound { .. } => panic!("expected Ok"),
        }
    }

    #[tokio::test]
    async fn move_down_existing_node() {
        let storage = InMemoryStorage::new();
        let handler = OutlineHandler;
        seed_node(&storage, "n1", "root", 0, 0).await;

        let result = handler
            .move_down(MoveDownInput { node_id: "n1".into() }, &storage)
            .await
            .unwrap();
        match result {
            MoveDownOutput::Ok { node_id } => assert_eq!(node_id, "n1"),
            MoveDownOutput::NotFound { .. } => panic!("expected Ok"),
        }
    }

    #[tokio::test]
    async fn reparent_node() {
        let storage = InMemoryStorage::new();
        let handler = OutlineHandler;
        seed_node(&storage, "n1", "root", 0, 0).await;

        let result = handler
            .reparent(
                ReparentInput {
                    node_id: "n1".into(),
                    new_parent_id: "parent2".into(),
                    position: 0,
                },
                &storage,
            )
            .await
            .unwrap();
        match result {
            ReparentOutput::Ok { node_id } => assert_eq!(node_id, "n1"),
        }
    }

    #[tokio::test]
    async fn collapse_and_expand() {
        let storage = InMemoryStorage::new();
        let handler = OutlineHandler;
        seed_node(&storage, "n1", "root", 0, 0).await;

        let collapse_result = handler
            .collapse(CollapseInput { node_id: "n1".into() }, &storage)
            .await
            .unwrap();
        match collapse_result {
            CollapseOutput::Ok { node_id } => assert_eq!(node_id, "n1"),
            CollapseOutput::NotFound { .. } => panic!("expected Ok"),
        }

        let expand_result = handler
            .expand(ExpandInput { node_id: "n1".into() }, &storage)
            .await
            .unwrap();
        match expand_result {
            ExpandOutput::Ok { node_id } => assert_eq!(node_id, "n1"),
            ExpandOutput::NotFound { .. } => panic!("expected Ok"),
        }
    }

    #[tokio::test]
    async fn collapse_not_found() {
        let storage = InMemoryStorage::new();
        let handler = OutlineHandler;
        let result = handler
            .collapse(CollapseInput { node_id: "missing".into() }, &storage)
            .await
            .unwrap();
        assert!(matches!(result, CollapseOutput::NotFound { .. }));
    }

    #[tokio::test]
    async fn zoom_into_node_with_children() {
        let storage = InMemoryStorage::new();
        let handler = OutlineHandler;
        seed_node(&storage, "parent", "root", 0, 0).await;
        seed_node(&storage, "child1", "parent", 1, 0).await;
        seed_node(&storage, "child2", "parent", 1, 1).await;

        let result = handler
            .zoom(ZoomInput { node_id: "parent".into() }, &storage)
            .await
            .unwrap();
        match result {
            ZoomOutput::Ok { node_id, children } => {
                assert_eq!(node_id, "parent");
                let parsed: Vec<serde_json::Value> = serde_json::from_str(&children).unwrap();
                assert_eq!(parsed.len(), 2);
            }
            ZoomOutput::NotFound { .. } => panic!("expected Ok"),
        }
    }

    #[tokio::test]
    async fn zoom_not_found() {
        let storage = InMemoryStorage::new();
        let handler = OutlineHandler;
        let result = handler
            .zoom(ZoomInput { node_id: "missing".into() }, &storage)
            .await
            .unwrap();
        assert!(matches!(result, ZoomOutput::NotFound { .. }));
    }
}
