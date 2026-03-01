// DAGHistory Handler Implementation
//
// Organize versions into a directed acyclic graph supporting
// branching, merging, and topological traversal. Nodes reference
// content by hash and track parent relationships for full history
// reconstruction.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::DAGHistoryHandler;
use serde_json::json;
use std::collections::{HashSet, VecDeque, HashMap};
use std::sync::atomic::{AtomicU64, Ordering};

static ID_COUNTER: AtomicU64 = AtomicU64::new(0);

fn next_id() -> String {
    let id = ID_COUNTER.fetch_add(1, Ordering::SeqCst) + 1;
    format!("dag-history-{}", id)
}

pub struct DAGHistoryHandlerImpl;

/// Topological sort of node IDs based on parent relationships.
async fn topological_sort(
    node_ids: &[String],
    storage: &dyn ConceptStorage,
) -> Result<Vec<String>, Box<dyn std::error::Error>> {
    if node_ids.len() <= 1 {
        return Ok(node_ids.to_vec());
    }

    let node_set: HashSet<&str> = node_ids.iter().map(|s| s.as_str()).collect();
    let mut in_degree: HashMap<String, usize> = HashMap::new();
    let mut adj_list: HashMap<String, Vec<String>> = HashMap::new();

    for id in node_ids {
        in_degree.insert(id.clone(), 0);
        adj_list.insert(id.clone(), Vec::new());
    }

    for id in node_ids {
        let node = storage.get("dag-history", id).await?;
        if let Some(node) = node {
            if let Some(parents) = node["parents"].as_array() {
                for parent in parents {
                    let parent_str = parent.as_str().unwrap_or("");
                    if node_set.contains(parent_str) {
                        adj_list.entry(parent_str.to_string()).or_default().push(id.clone());
                        *in_degree.entry(id.clone()).or_insert(0) += 1;
                    }
                }
            }
        }
    }

    let mut queue: VecDeque<String> = VecDeque::new();
    for (id, deg) in &in_degree {
        if *deg == 0 {
            queue.push_back(id.clone());
        }
    }

    let mut result = Vec::new();
    while let Some(current) = queue.pop_front() {
        result.push(current.clone());
        if let Some(neighbors) = adj_list.get(&current) {
            for neighbor in neighbors {
                let deg = in_degree.get_mut(neighbor).unwrap();
                *deg -= 1;
                if *deg == 0 {
                    queue.push_back(neighbor.clone());
                }
            }
        }
    }

    Ok(result)
}

#[async_trait]
impl DAGHistoryHandler for DAGHistoryHandlerImpl {
    async fn append(
        &self,
        input: DAGHistoryAppendInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DAGHistoryAppendOutput, Box<dyn std::error::Error>> {
        let parent_list: Vec<String> = input.parents.into_iter().collect();

        // Verify all parents exist
        for parent_id in &parent_list {
            let parent = storage.get("dag-history", parent_id).await?;
            if parent.is_none() {
                return Ok(DAGHistoryAppendOutput::UnknownParent {
                    message: format!("Parent node '{}' not found in the DAG", parent_id),
                });
            }
        }

        let node_id = next_id();
        let now = chrono::Utc::now().to_rfc3339();
        let is_root = parent_list.is_empty();

        storage.put("dag-history", &node_id, json!({
            "id": node_id,
            "nodeId": node_id,
            "parents": parent_list,
            "contentRef": input.content_ref,
            "metadata": base64::encode(&input.metadata),
            "created": now,
            "isRoot": is_root,
            "children": [],
        })).await?;

        // Register children on parent nodes for descendant traversal
        for parent_id in &parent_list {
            if let Some(mut parent) = storage.get("dag-history", parent_id).await? {
                let mut children: Vec<String> = parent["children"]
                    .as_array()
                    .map(|arr| arr.iter().filter_map(|v| v.as_str().map(String::from)).collect())
                    .unwrap_or_default();
                children.push(node_id.clone());
                parent["children"] = json!(children);
                storage.put("dag-history", parent_id, parent).await?;
            }
        }

        Ok(DAGHistoryAppendOutput::Ok { node_id })
    }

    async fn ancestors(
        &self,
        input: DAGHistoryAncestorsInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DAGHistoryAncestorsOutput, Box<dyn std::error::Error>> {
        let node = storage.get("dag-history", &input.node_id).await?;
        if node.is_none() {
            return Ok(DAGHistoryAncestorsOutput::NotFound {
                message: format!("Node '{}' not in DAG", input.node_id),
            });
        }

        let node = node.unwrap();
        let mut visited = HashSet::new();
        let mut ancestors = Vec::new();
        let mut queue: VecDeque<String> = VecDeque::new();

        // Start from parents of the given node
        if let Some(parents) = node["parents"].as_array() {
            for p in parents {
                if let Some(s) = p.as_str() {
                    queue.push_back(s.to_string());
                }
            }
        }

        while let Some(current) = queue.pop_front() {
            if visited.contains(&current) {
                continue;
            }
            visited.insert(current.clone());
            ancestors.push(current.clone());

            if let Some(current_node) = storage.get("dag-history", &current).await? {
                if let Some(parents) = current_node["parents"].as_array() {
                    for p in parents {
                        if let Some(s) = p.as_str() {
                            if !visited.contains(s) {
                                queue.push_back(s.to_string());
                            }
                        }
                    }
                }
            }
        }

        let sorted = topological_sort(&ancestors, storage).await?;
        Ok(DAGHistoryAncestorsOutput::Ok { nodes: sorted })
    }

    async fn common_ancestor(
        &self,
        input: DAGHistoryCommonAncestorInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DAGHistoryCommonAncestorOutput, Box<dyn std::error::Error>> {
        let node_a = storage.get("dag-history", &input.a).await?;
        if node_a.is_none() {
            return Ok(DAGHistoryCommonAncestorOutput::NotFound {
                message: format!("Node '{}' not in DAG", input.a),
            });
        }

        let node_b = storage.get("dag-history", &input.b).await?;
        if node_b.is_none() {
            return Ok(DAGHistoryCommonAncestorOutput::NotFound {
                message: format!("Node '{}' not in DAG", input.b),
            });
        }

        // Collect all ancestors of A (including A itself)
        let mut ancestors_a = HashSet::new();
        let mut queue_a: VecDeque<String> = VecDeque::new();
        queue_a.push_back(input.a.clone());
        while let Some(current) = queue_a.pop_front() {
            if ancestors_a.contains(&current) {
                continue;
            }
            ancestors_a.insert(current.clone());
            if let Some(node) = storage.get("dag-history", &current).await? {
                if let Some(parents) = node["parents"].as_array() {
                    for p in parents {
                        if let Some(s) = p.as_str() {
                            queue_a.push_back(s.to_string());
                        }
                    }
                }
            }
        }

        // BFS from B, find first intersection
        let mut visited_b = HashSet::new();
        let mut queue_b: VecDeque<String> = VecDeque::new();
        queue_b.push_back(input.b.clone());
        while let Some(current) = queue_b.pop_front() {
            if visited_b.contains(&current) {
                continue;
            }
            visited_b.insert(current.clone());

            if ancestors_a.contains(&current) && current != input.a && current != input.b {
                return Ok(DAGHistoryCommonAncestorOutput::Found { node_id: current });
            }

            if let Some(node) = storage.get("dag-history", &current).await? {
                if let Some(parents) = node["parents"].as_array() {
                    for p in parents {
                        if let Some(s) = p.as_str() {
                            if !visited_b.contains(s) {
                                queue_b.push_back(s.to_string());
                            }
                        }
                    }
                }
            }
        }

        // Check if a itself is ancestor of b or vice versa
        if visited_b.contains(&input.a) {
            return Ok(DAGHistoryCommonAncestorOutput::Found { node_id: input.a });
        }
        if ancestors_a.contains(&input.b) {
            return Ok(DAGHistoryCommonAncestorOutput::Found { node_id: input.b });
        }

        Ok(DAGHistoryCommonAncestorOutput::None {
            message: "No common ancestor exists -- disjoint DAG histories".to_string(),
        })
    }

    async fn descendants(
        &self,
        input: DAGHistoryDescendantsInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DAGHistoryDescendantsOutput, Box<dyn std::error::Error>> {
        let node = storage.get("dag-history", &input.node_id).await?;
        if node.is_none() {
            return Ok(DAGHistoryDescendantsOutput::NotFound {
                message: format!("Node '{}' not in DAG", input.node_id),
            });
        }

        let node = node.unwrap();
        let mut visited = HashSet::new();
        let mut descendants = Vec::new();
        let mut queue: VecDeque<String> = VecDeque::new();

        if let Some(children) = node["children"].as_array() {
            for c in children {
                if let Some(s) = c.as_str() {
                    queue.push_back(s.to_string());
                }
            }
        }

        while let Some(current) = queue.pop_front() {
            if visited.contains(&current) {
                continue;
            }
            visited.insert(current.clone());
            descendants.push(current.clone());

            if let Some(current_node) = storage.get("dag-history", &current).await? {
                if let Some(children) = current_node["children"].as_array() {
                    for c in children {
                        if let Some(s) = c.as_str() {
                            if !visited.contains(s) {
                                queue.push_back(s.to_string());
                            }
                        }
                    }
                }
            }
        }

        Ok(DAGHistoryDescendantsOutput::Ok { nodes: descendants })
    }

    async fn between(
        &self,
        input: DAGHistoryBetweenInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DAGHistoryBetweenOutput, Box<dyn std::error::Error>> {
        let from_node = storage.get("dag-history", &input.from).await?;
        if from_node.is_none() {
            return Ok(DAGHistoryBetweenOutput::NotFound {
                message: format!("Node '{}' not in DAG", input.from),
            });
        }

        let to_node = storage.get("dag-history", &input.to).await?;
        if to_node.is_none() {
            return Ok(DAGHistoryBetweenOutput::NotFound {
                message: format!("Node '{}' not in DAG", input.to),
            });
        }

        // BFS from 'to' backwards to find 'from', then reconstruct path
        let mut visited: HashMap<String, Option<String>> = HashMap::new();
        let mut queue: VecDeque<String> = VecDeque::new();
        queue.push_back(input.to.clone());
        visited.insert(input.to.clone(), Option::None);

        let mut found = false;
        while let Some(current) = queue.pop_front() {
            if current == input.from {
                found = true;
                break;
            }

            if let Some(current_node) = storage.get("dag-history", &current).await? {
                if let Some(parents) = current_node["parents"].as_array() {
                    for p in parents {
                        if let Some(s) = p.as_str() {
                            if !visited.contains_key(s) {
                                visited.insert(s.to_string(), Some(current.clone()));
                                queue.push_back(s.to_string());
                            }
                        }
                    }
                }
            }
        }

        if !found {
            return Ok(DAGHistoryBetweenOutput::NoPath {
                message: format!("No directed path between '{}' and '{}'", input.from, input.to),
            });
        }

        // Reconstruct path from 'from' to 'to'
        let mut path = Vec::new();
        let mut cursor = input.from.clone();
        path.push(cursor.clone());

        // Walk from 'from' toward 'to' using the visited map
        // visited maps parent -> child that discovered it
        loop {
            if cursor == input.to {
                break;
            }
            if let Some(Some(next)) = visited.get(&cursor) {
                cursor = next.clone();
                path.push(cursor.clone());
            } else {
                break;
            }
        }

        Ok(DAGHistoryBetweenOutput::Ok { path })
    }

    async fn get_node(
        &self,
        input: DAGHistoryGetNodeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DAGHistoryGetNodeOutput, Box<dyn std::error::Error>> {
        let record = storage.get("dag-history", &input.node_id).await?;
        match record {
            None => Ok(DAGHistoryGetNodeOutput::NotFound {
                message: format!("Node '{}' not in DAG", input.node_id),
            }),
            Some(rec) => {
                let parents: HashSet<String> = rec["parents"]
                    .as_array()
                    .map(|arr| arr.iter().filter_map(|v| v.as_str().map(String::from)).collect())
                    .unwrap_or_default();

                let content_ref = rec["contentRef"].as_str().unwrap_or("").to_string();
                let metadata_str = rec["metadata"].as_str().unwrap_or("");
                let metadata = base64::decode(metadata_str).unwrap_or_default();

                Ok(DAGHistoryGetNodeOutput::Ok {
                    parents,
                    content_ref,
                    metadata,
                })
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_append_root_node() {
        let storage = InMemoryStorage::new();
        let handler = DAGHistoryHandlerImpl;
        let result = handler.append(
            DAGHistoryAppendInput {
                parents: HashSet::new(),
                content_ref: "hash-abc123".to_string(),
                metadata: b"initial commit".to_vec(),
            },
            &storage,
        ).await.unwrap();
        match result {
            DAGHistoryAppendOutput::Ok { node_id } => {
                assert!(node_id.starts_with("dag-history-"));
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_append_unknown_parent() {
        let storage = InMemoryStorage::new();
        let handler = DAGHistoryHandlerImpl;
        let mut parents = HashSet::new();
        parents.insert("nonexistent-parent".to_string());

        let result = handler.append(
            DAGHistoryAppendInput {
                parents,
                content_ref: "hash-xyz".to_string(),
                metadata: vec![],
            },
            &storage,
        ).await.unwrap();
        match result {
            DAGHistoryAppendOutput::UnknownParent { message } => {
                assert!(message.contains("nonexistent-parent"));
            },
            _ => panic!("Expected UnknownParent variant"),
        }
    }

    #[tokio::test]
    async fn test_ancestors_not_found() {
        let storage = InMemoryStorage::new();
        let handler = DAGHistoryHandlerImpl;
        let result = handler.ancestors(
            DAGHistoryAncestorsInput { node_id: "nonexistent".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            DAGHistoryAncestorsOutput::NotFound { .. } => {},
            _ => panic!("Expected NotFound variant"),
        }
    }

    #[tokio::test]
    async fn test_descendants_not_found() {
        let storage = InMemoryStorage::new();
        let handler = DAGHistoryHandlerImpl;
        let result = handler.descendants(
            DAGHistoryDescendantsInput { node_id: "nonexistent".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            DAGHistoryDescendantsOutput::NotFound { .. } => {},
            _ => panic!("Expected NotFound variant"),
        }
    }

    #[tokio::test]
    async fn test_common_ancestor_not_found() {
        let storage = InMemoryStorage::new();
        let handler = DAGHistoryHandlerImpl;
        let result = handler.common_ancestor(
            DAGHistoryCommonAncestorInput {
                a: "nonexistent-a".to_string(),
                b: "nonexistent-b".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            DAGHistoryCommonAncestorOutput::NotFound { .. } => {},
            _ => panic!("Expected NotFound variant"),
        }
    }

    #[tokio::test]
    async fn test_between_not_found() {
        let storage = InMemoryStorage::new();
        let handler = DAGHistoryHandlerImpl;
        let result = handler.between(
            DAGHistoryBetweenInput {
                from: "nonexistent".to_string(),
                to: "also-nonexistent".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            DAGHistoryBetweenOutput::NotFound { .. } => {},
            _ => panic!("Expected NotFound variant"),
        }
    }

    #[tokio::test]
    async fn test_get_node_not_found() {
        let storage = InMemoryStorage::new();
        let handler = DAGHistoryHandlerImpl;
        let result = handler.get_node(
            DAGHistoryGetNodeInput { node_id: "nonexistent".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            DAGHistoryGetNodeOutput::NotFound { .. } => {},
            _ => panic!("Expected NotFound variant"),
        }
    }

    #[tokio::test]
    async fn test_append_then_get_node() {
        let storage = InMemoryStorage::new();
        let handler = DAGHistoryHandlerImpl;

        let append_result = handler.append(
            DAGHistoryAppendInput {
                parents: HashSet::new(),
                content_ref: "hash-root".to_string(),
                metadata: b"root".to_vec(),
            },
            &storage,
        ).await.unwrap();

        let node_id = match append_result {
            DAGHistoryAppendOutput::Ok { node_id } => node_id,
            _ => panic!("Expected Ok"),
        };

        let result = handler.get_node(
            DAGHistoryGetNodeInput { node_id },
            &storage,
        ).await.unwrap();
        match result {
            DAGHistoryGetNodeOutput::Ok { content_ref, parents, .. } => {
                assert_eq!(content_ref, "hash-root");
                assert!(parents.is_empty());
            },
            _ => panic!("Expected Ok variant"),
        }
    }
}
