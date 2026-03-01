// Graph concept implementation
// Directed graph with node/edge management and BFS neighbor traversal with depth control.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::GraphHandler;
use serde_json::json;
use std::collections::{HashMap, HashSet, VecDeque};

pub struct GraphHandlerImpl;

/// Deserialize the adjacency list from storage JSON
fn load_adjacency(record: &serde_json::Value) -> HashMap<String, Vec<String>> {
    record.get("adjacency")
        .and_then(|v| v.as_str())
        .and_then(|s| serde_json::from_str(s).ok())
        .unwrap_or_default()
}

/// Deserialize the node set from storage JSON
fn load_nodes(record: &serde_json::Value) -> HashSet<String> {
    record.get("nodes")
        .and_then(|v| v.as_str())
        .and_then(|s| serde_json::from_str(s).ok())
        .unwrap_or_default()
}

#[async_trait]
impl GraphHandler for GraphHandlerImpl {
    async fn add_node(
        &self,
        input: GraphAddNodeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<GraphAddNodeOutput, Box<dyn std::error::Error>> {
        let record = storage.get("graph", &input.graph).await?;
        let mut graph_data = record.unwrap_or_else(|| json!({
            "graph": input.graph.clone(),
            "nodes": "[]",
            "adjacency": "{}",
        }));

        let mut nodes = load_nodes(&graph_data);
        nodes.insert(input.node.clone());

        graph_data["nodes"] = json!(serde_json::to_string(&nodes)?);
        storage.put("graph", &input.graph, graph_data).await?;

        Ok(GraphAddNodeOutput::Ok)
    }

    async fn remove_node(
        &self,
        input: GraphRemoveNodeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<GraphRemoveNodeOutput, Box<dyn std::error::Error>> {
        let record = storage.get("graph", &input.graph).await?;
        let Some(mut graph_data) = record else {
            return Ok(GraphRemoveNodeOutput::Notfound);
        };

        let mut nodes = load_nodes(&graph_data);
        if !nodes.remove(&input.node) {
            return Ok(GraphRemoveNodeOutput::Notfound);
        }

        // Remove all edges involving this node
        let mut adj = load_adjacency(&graph_data);
        adj.remove(&input.node);
        for edges in adj.values_mut() {
            edges.retain(|target| target != &input.node);
        }

        graph_data["nodes"] = json!(serde_json::to_string(&nodes)?);
        graph_data["adjacency"] = json!(serde_json::to_string(&adj)?);
        storage.put("graph", &input.graph, graph_data).await?;

        Ok(GraphRemoveNodeOutput::Ok)
    }

    async fn add_edge(
        &self,
        input: GraphAddEdgeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<GraphAddEdgeOutput, Box<dyn std::error::Error>> {
        let record = storage.get("graph", &input.graph).await?;
        let Some(mut graph_data) = record else {
            return Ok(GraphAddEdgeOutput::Notfound);
        };

        let nodes = load_nodes(&graph_data);
        if !nodes.contains(&input.source) || !nodes.contains(&input.target) {
            return Ok(GraphAddEdgeOutput::Notfound);
        }

        let mut adj = load_adjacency(&graph_data);
        let edges = adj.entry(input.source.clone()).or_insert_with(Vec::new);
        if !edges.contains(&input.target) {
            edges.push(input.target.clone());
        }

        graph_data["adjacency"] = json!(serde_json::to_string(&adj)?);
        storage.put("graph", &input.graph, graph_data).await?;

        Ok(GraphAddEdgeOutput::Ok)
    }

    async fn remove_edge(
        &self,
        input: GraphRemoveEdgeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<GraphRemoveEdgeOutput, Box<dyn std::error::Error>> {
        let record = storage.get("graph", &input.graph).await?;
        let Some(mut graph_data) = record else {
            return Ok(GraphRemoveEdgeOutput::Notfound);
        };

        let mut adj = load_adjacency(&graph_data);
        if let Some(edges) = adj.get_mut(&input.source) {
            let before = edges.len();
            edges.retain(|t| t != &input.target);
            if edges.len() == before {
                return Ok(GraphRemoveEdgeOutput::Notfound);
            }
        } else {
            return Ok(GraphRemoveEdgeOutput::Notfound);
        }

        graph_data["adjacency"] = json!(serde_json::to_string(&adj)?);
        storage.put("graph", &input.graph, graph_data).await?;

        Ok(GraphRemoveEdgeOutput::Ok)
    }

    async fn get_neighbors(
        &self,
        input: GraphGetNeighborsInput,
        storage: &dyn ConceptStorage,
    ) -> Result<GraphGetNeighborsOutput, Box<dyn std::error::Error>> {
        let record = storage.get("graph", &input.graph).await?;
        let Some(graph_data) = record else {
            return Ok(GraphGetNeighborsOutput::Notfound);
        };

        let nodes = load_nodes(&graph_data);
        if !nodes.contains(&input.node) {
            return Ok(GraphGetNeighborsOutput::Notfound);
        }

        let adj = load_adjacency(&graph_data);

        // BFS up to specified depth
        let max_depth = input.depth.max(1) as usize;
        let mut visited: HashSet<String> = HashSet::new();
        let mut queue: VecDeque<(String, usize)> = VecDeque::new();
        let mut result: Vec<String> = Vec::new();

        visited.insert(input.node.clone());
        queue.push_back((input.node.clone(), 0));

        while let Some((current, depth)) = queue.pop_front() {
            if depth >= max_depth {
                continue;
            }
            if let Some(neighbors) = adj.get(&current) {
                for neighbor in neighbors {
                    if visited.insert(neighbor.clone()) {
                        result.push(neighbor.clone());
                        queue.push_back((neighbor.clone(), depth + 1));
                    }
                }
            }
        }

        Ok(GraphGetNeighborsOutput::Ok {
            neighbors: serde_json::to_string(&result)?,
        })
    }

    async fn filter_nodes(
        &self,
        input: GraphFilterNodesInput,
        storage: &dyn ConceptStorage,
    ) -> Result<GraphFilterNodesOutput, Box<dyn std::error::Error>> {
        let record = storage.get("graph", &input.graph).await?;
        let Some(graph_data) = record else {
            return Ok(GraphFilterNodesOutput::Notfound);
        };

        let nodes = load_nodes(&graph_data);
        let filter_lower = input.filter.to_lowercase();

        // Filter nodes by substring match on node ID
        let filtered: Vec<&String> = nodes.iter()
            .filter(|n| n.to_lowercase().contains(&filter_lower))
            .collect();

        Ok(GraphFilterNodesOutput::Ok {
            filtered: serde_json::to_string(&filtered)?,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_add_node() {
        let storage = InMemoryStorage::new();
        let handler = GraphHandlerImpl;
        let result = handler.add_node(
            GraphAddNodeInput { graph: "g1".to_string(), node: "A".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            GraphAddNodeOutput::Ok => {},
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_remove_node_notfound() {
        let storage = InMemoryStorage::new();
        let handler = GraphHandlerImpl;
        let result = handler.remove_node(
            GraphRemoveNodeInput { graph: "g1".to_string(), node: "A".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            GraphRemoveNodeOutput::Notfound => {},
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_add_edge_success() {
        let storage = InMemoryStorage::new();
        let handler = GraphHandlerImpl;
        handler.add_node(GraphAddNodeInput { graph: "g1".to_string(), node: "A".to_string() }, &storage).await.unwrap();
        handler.add_node(GraphAddNodeInput { graph: "g1".to_string(), node: "B".to_string() }, &storage).await.unwrap();
        let result = handler.add_edge(
            GraphAddEdgeInput { graph: "g1".to_string(), source: "A".to_string(), target: "B".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            GraphAddEdgeOutput::Ok => {},
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_add_edge_missing_node() {
        let storage = InMemoryStorage::new();
        let handler = GraphHandlerImpl;
        handler.add_node(GraphAddNodeInput { graph: "g1".to_string(), node: "A".to_string() }, &storage).await.unwrap();
        let result = handler.add_edge(
            GraphAddEdgeInput { graph: "g1".to_string(), source: "A".to_string(), target: "C".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            GraphAddEdgeOutput::Notfound => {},
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_remove_edge_notfound() {
        let storage = InMemoryStorage::new();
        let handler = GraphHandlerImpl;
        let result = handler.remove_edge(
            GraphRemoveEdgeInput { graph: "g1".to_string(), source: "A".to_string(), target: "B".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            GraphRemoveEdgeOutput::Notfound => {},
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_get_neighbors() {
        let storage = InMemoryStorage::new();
        let handler = GraphHandlerImpl;
        handler.add_node(GraphAddNodeInput { graph: "g2".to_string(), node: "X".to_string() }, &storage).await.unwrap();
        handler.add_node(GraphAddNodeInput { graph: "g2".to_string(), node: "Y".to_string() }, &storage).await.unwrap();
        handler.add_edge(GraphAddEdgeInput { graph: "g2".to_string(), source: "X".to_string(), target: "Y".to_string() }, &storage).await.unwrap();
        let result = handler.get_neighbors(
            GraphGetNeighborsInput { graph: "g2".to_string(), node: "X".to_string(), depth: 1 },
            &storage,
        ).await.unwrap();
        match result {
            GraphGetNeighborsOutput::Ok { neighbors } => {
                assert!(neighbors.contains("Y"));
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_filter_nodes_notfound() {
        let storage = InMemoryStorage::new();
        let handler = GraphHandlerImpl;
        let result = handler.filter_nodes(
            GraphFilterNodesInput { graph: "missing".to_string(), filter: "test".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            GraphFilterNodesOutput::Notfound => {},
            _ => panic!("Expected Notfound variant"),
        }
    }
}
