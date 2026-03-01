// TreeDiff Handler Implementation
//
// Compute structure-aware diffs for tree-shaped content such as JSON and
// ASTs. Uses tree edit distance to preserve structural relationships
// lost by line-oriented diffs.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::TreeDiffHandler;
use serde_json::json;
use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};

static ID_COUNTER: AtomicU64 = AtomicU64::new(0);

fn next_id() -> String {
    let n = ID_COUNTER.fetch_add(1, Ordering::SeqCst) + 1;
    format!("tree-diff-{}", n)
}

/// Internal tree node for structural diffing.
struct TreeNode {
    label: String,
    value: Option<serde_json::Value>,
    children: Vec<TreeNode>,
}

/// An edit operation in a tree diff.
#[derive(serde::Serialize)]
struct TreeEditOp {
    #[serde(rename = "type")]
    op_type: String,
    path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    old_value: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    new_value: Option<serde_json::Value>,
}

/// Convert a JSON value into a labeled tree structure.
fn json_to_tree(value: &serde_json::Value, label: &str) -> TreeNode {
    match value {
        serde_json::Value::Null => TreeNode {
            label: label.to_string(),
            value: Some(serde_json::Value::Null),
            children: Vec::new(),
        },
        serde_json::Value::Bool(_) | serde_json::Value::Number(_) | serde_json::Value::String(_) => {
            TreeNode {
                label: label.to_string(),
                value: Some(value.clone()),
                children: Vec::new(),
            }
        }
        serde_json::Value::Array(arr) => TreeNode {
            label: label.to_string(),
            value: None,
            children: arr
                .iter()
                .enumerate()
                .map(|(i, item)| json_to_tree(item, &format!("[{}]", i)))
                .collect(),
        },
        serde_json::Value::Object(obj) => TreeNode {
            label: label.to_string(),
            value: None,
            children: obj
                .iter()
                .map(|(key, val)| json_to_tree(val, key))
                .collect(),
        },
    }
}

/// Convert a tree node back to a plain JSON value.
fn tree_to_value(node: &TreeNode) -> serde_json::Value {
    if node.children.is_empty() {
        return node.value.clone().unwrap_or(serde_json::Value::Null);
    }
    // If children have array-style labels, reconstruct as array
    if !node.children.is_empty() && node.children[0].label.starts_with('[') {
        let arr: Vec<serde_json::Value> = node.children.iter().map(tree_to_value).collect();
        return serde_json::Value::Array(arr);
    }
    // Otherwise reconstruct as object
    let mut map = serde_json::Map::new();
    for child in &node.children {
        map.insert(child.label.clone(), tree_to_value(child));
    }
    serde_json::Value::Object(map)
}

/// Compute structural diff between two JSON trees.
fn diff_trees(node_a: &TreeNode, node_b: &TreeNode, path: &str) -> Vec<TreeEditOp> {
    let mut ops = Vec::new();
    let current_path = if path.is_empty() {
        node_a.label.clone()
    } else {
        format!("{}.{}", path, node_a.label)
    };

    // Leaf comparison
    if node_a.children.is_empty() && node_b.children.is_empty() {
        if node_a.value == node_b.value {
            ops.push(TreeEditOp {
                op_type: "equal".to_string(),
                path: current_path,
                old_value: None,
                new_value: None,
            });
        } else {
            ops.push(TreeEditOp {
                op_type: "update".to_string(),
                path: current_path,
                old_value: node_a.value.clone(),
                new_value: node_b.value.clone(),
            });
        }
        return ops;
    }

    // Build child maps by label
    let children_a: HashMap<&str, &TreeNode> =
        node_a.children.iter().map(|c| (c.label.as_str(), c)).collect();
    let children_b: HashMap<&str, &TreeNode> =
        node_b.children.iter().map(|c| (c.label.as_str(), c)).collect();

    // Children in A
    for (label, child_a) in &children_a {
        if let Some(child_b) = children_b.get(label) {
            ops.extend(diff_trees(child_a, child_b, &current_path));
        } else {
            // Deleted in B
            ops.push(TreeEditOp {
                op_type: "delete".to_string(),
                path: format!("{}.{}", current_path, label),
                old_value: Some(tree_to_value(child_a)),
                new_value: None,
            });
        }
    }

    // Children only in B (inserts)
    for (label, child_b) in &children_b {
        if !children_a.contains_key(label) {
            ops.push(TreeEditOp {
                op_type: "insert".to_string(),
                path: format!("{}.{}", current_path, label),
                old_value: None,
                new_value: Some(tree_to_value(child_b)),
            });
        }
    }

    ops
}

pub struct TreeDiffHandlerImpl;

#[async_trait]
impl TreeDiffHandler for TreeDiffHandlerImpl {
    async fn register(
        &self,
        _input: TreeDiffRegisterInput,
        _storage: &dyn ConceptStorage,
    ) -> Result<TreeDiffRegisterOutput, Box<dyn std::error::Error>> {
        Ok(TreeDiffRegisterOutput::Ok {
            name: "tree".to_string(),
            category: "diff".to_string(),
            content_types: vec![
                "application/json".to_string(),
                "application/xml".to_string(),
                "text/xml".to_string(),
            ],
        })
    }

    async fn compute(
        &self,
        input: TreeDiffComputeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TreeDiffComputeOutput, Box<dyn std::error::Error>> {
        // Parse content_a and content_b as JSON from byte slices
        let content_a_str = String::from_utf8_lossy(&input.content_a);
        let content_b_str = String::from_utf8_lossy(&input.content_b);

        let parsed_a: serde_json::Value = match serde_json::from_str(&content_a_str) {
            Ok(v) => v,
            Err(_) => {
                return Ok(TreeDiffComputeOutput::UnsupportedContent {
                    message: "Content A is not a valid tree structure (failed JSON parse)".to_string(),
                });
            }
        };

        let parsed_b: serde_json::Value = match serde_json::from_str(&content_b_str) {
            Ok(v) => v,
            Err(_) => {
                return Ok(TreeDiffComputeOutput::UnsupportedContent {
                    message: "Content B is not a valid tree structure (failed JSON parse)".to_string(),
                });
            }
        };

        let tree_a = json_to_tree(&parsed_a, "root");
        let tree_b = json_to_tree(&parsed_b, "root");

        let edit_ops = diff_trees(&tree_a, &tree_b, "");
        let distance = edit_ops.iter().filter(|op| op.op_type != "equal").count() as i64;
        let edit_script_json = serde_json::to_string(&edit_ops)?;

        // Persist the diff result
        let id = next_id();
        storage.put("tree-diff", &id, json!({
            "id": id,
            "editScript": edit_script_json,
            "distance": distance,
        })).await?;

        Ok(TreeDiffComputeOutput::Ok {
            edit_script: edit_script_json.into_bytes(),
            distance,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_register() {
        let storage = InMemoryStorage::new();
        let handler = TreeDiffHandlerImpl;
        let result = handler.register(
            TreeDiffRegisterInput {},
            &storage,
        ).await.unwrap();
        match result {
            TreeDiffRegisterOutput::Ok { name, category, content_types } => {
                assert_eq!(name, "tree");
                assert_eq!(category, "diff");
                assert!(content_types.contains(&"application/json".to_string()));
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_compute_identical() {
        let storage = InMemoryStorage::new();
        let handler = TreeDiffHandlerImpl;
        let json = r#"{"a":1,"b":2}"#;
        let result = handler.compute(
            TreeDiffComputeInput {
                content_a: json.as_bytes().to_vec(),
                content_b: json.as_bytes().to_vec(),
            },
            &storage,
        ).await.unwrap();
        match result {
            TreeDiffComputeOutput::Ok { distance, .. } => {
                assert_eq!(distance, 0);
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_compute_with_changes() {
        let storage = InMemoryStorage::new();
        let handler = TreeDiffHandlerImpl;
        let result = handler.compute(
            TreeDiffComputeInput {
                content_a: r#"{"a":1,"b":2}"#.as_bytes().to_vec(),
                content_b: r#"{"a":1,"b":3}"#.as_bytes().to_vec(),
            },
            &storage,
        ).await.unwrap();
        match result {
            TreeDiffComputeOutput::Ok { distance, .. } => {
                assert!(distance > 0);
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_compute_invalid_json_a() {
        let storage = InMemoryStorage::new();
        let handler = TreeDiffHandlerImpl;
        let result = handler.compute(
            TreeDiffComputeInput {
                content_a: b"not json".to_vec(),
                content_b: r#"{"a":1}"#.as_bytes().to_vec(),
            },
            &storage,
        ).await.unwrap();
        match result {
            TreeDiffComputeOutput::UnsupportedContent { .. } => {},
            _ => panic!("Expected UnsupportedContent variant"),
        }
    }

    #[tokio::test]
    async fn test_compute_invalid_json_b() {
        let storage = InMemoryStorage::new();
        let handler = TreeDiffHandlerImpl;
        let result = handler.compute(
            TreeDiffComputeInput {
                content_a: r#"{"a":1}"#.as_bytes().to_vec(),
                content_b: b"not json".to_vec(),
            },
            &storage,
        ).await.unwrap();
        match result {
            TreeDiffComputeOutput::UnsupportedContent { .. } => {},
            _ => panic!("Expected UnsupportedContent variant"),
        }
    }
}
