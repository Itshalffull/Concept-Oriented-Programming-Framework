// DependenceGraph Handler Implementation
//
// Data and control dependency edges between program elements.
// Enables forward and backward slicing, impact analysis, and
// dependency queries at file, module, or project scope.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::DependenceGraphHandler;
use serde_json::json;
use std::collections::{HashMap, HashSet, VecDeque};
use std::sync::atomic::{AtomicU64, Ordering};

static ID_COUNTER: AtomicU64 = AtomicU64::new(0);

fn next_id() -> String {
    let id = ID_COUNTER.fetch_add(1, Ordering::SeqCst) + 1;
    format!("dependence-graph-{}", id)
}

#[derive(Clone)]
struct Edge {
    from: String,
    to: String,
    kind: String,
}

fn infer_scope(scope_ref: &str) -> &str {
    if scope_ref.contains('/') || scope_ref.ends_with(".ts") || scope_ref.ends_with(".tsx") || scope_ref.ends_with(".js") {
        "file"
    } else if scope_ref.contains("::") || scope_ref.contains('.') {
        "module"
    } else {
        "project"
    }
}

fn parse_edge_kinds(edge_kinds: &str) -> Option<HashSet<String>> {
    if edge_kinds.trim().is_empty() {
        return None;
    }
    Some(edge_kinds.split(',').map(|k| k.trim().to_string()).collect())
}

async fn load_adjacency(
    graph_id: &str,
    storage: &dyn ConceptStorage,
) -> Result<(HashSet<String>, HashMap<String, Vec<Edge>>, HashMap<String, Vec<Edge>>), Box<dyn std::error::Error>> {
    let edges = storage.find("dependence-graph-edge", Some(&json!({ "graphId": graph_id }))).await?;
    let mut nodes = HashSet::new();
    let mut adj: HashMap<String, Vec<Edge>> = HashMap::new();
    let mut reverse_adj: HashMap<String, Vec<Edge>> = HashMap::new();

    for record in &edges {
        let from = record.get("from").and_then(|v| v.as_str()).unwrap_or_default().to_string();
        let to = record.get("to").and_then(|v| v.as_str()).unwrap_or_default().to_string();
        let kind = record.get("kind").and_then(|v| v.as_str()).unwrap_or_default().to_string();
        let edge = Edge { from: from.clone(), to: to.clone(), kind };

        nodes.insert(from.clone());
        nodes.insert(to.clone());
        adj.entry(from).or_default().push(edge.clone());
        reverse_adj.entry(to).or_default().push(edge);
    }

    Ok((nodes, adj, reverse_adj))
}

fn transitive_forward(
    start: &[String],
    adj: &HashMap<String, Vec<Edge>>,
    filter: &Option<HashSet<String>>,
) -> (HashSet<String>, Vec<Edge>) {
    let mut reachable = HashSet::new();
    let mut traversed = Vec::new();
    let mut queue: VecDeque<String> = start.iter().cloned().collect();

    while let Some(current) = queue.pop_front() {
        if reachable.contains(&current) { continue; }
        reachable.insert(current.clone());
        for edge in adj.get(&current).unwrap_or(&vec![]) {
            if let Some(f) = filter {
                if !f.contains(&edge.kind) { continue; }
            }
            traversed.push(edge.clone());
            if !reachable.contains(&edge.to) {
                queue.push_back(edge.to.clone());
            }
        }
    }

    (reachable, traversed)
}

fn transitive_backward(
    start: &[String],
    reverse_adj: &HashMap<String, Vec<Edge>>,
    filter: &Option<HashSet<String>>,
) -> (HashSet<String>, Vec<Edge>) {
    let mut reachable = HashSet::new();
    let mut traversed = Vec::new();
    let mut queue: VecDeque<String> = start.iter().cloned().collect();

    while let Some(current) = queue.pop_front() {
        if reachable.contains(&current) { continue; }
        reachable.insert(current.clone());
        for edge in reverse_adj.get(&current).unwrap_or(&vec![]) {
            if let Some(f) = filter {
                if !f.contains(&edge.kind) { continue; }
            }
            traversed.push(edge.clone());
            if !reachable.contains(&edge.from) {
                queue.push_back(edge.from.clone());
            }
        }
    }

    (reachable, traversed)
}

fn edges_to_json(edges: &[Edge]) -> Vec<serde_json::Value> {
    edges.iter().map(|e| json!({"from": e.from, "to": e.to, "kind": e.kind})).collect()
}

pub struct DependenceGraphHandlerImpl;

#[async_trait]
impl DependenceGraphHandler for DependenceGraphHandlerImpl {
    async fn compute(
        &self,
        input: DependenceGraphComputeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DependenceGraphComputeOutput, Box<dyn std::error::Error>> {
        let scope = infer_scope(&input.scope_ref);
        let id = next_id();

        storage.put("dependence-graph", &id, json!({
            "id": id,
            "scope": scope,
            "scopeRef": input.scope_ref,
            "nodes": "[]",
            "edges": "[]",
            "nodeCount": 0,
            "edgeCount": 0,
        })).await?;

        Ok(DependenceGraphComputeOutput::Ok { graph: id })
    }

    async fn query_dependents(
        &self,
        input: DependenceGraphQueryDependentsInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DependenceGraphQueryDependentsOutput, Box<dyn std::error::Error>> {
        let edge_filter = parse_edge_kinds(&input.edge_kinds);
        let graphs = storage.find("dependence-graph", None).await?;
        let mut all_dependents = Vec::new();

        for graph in &graphs {
            let graph_id = graph.get("id").and_then(|v| v.as_str()).unwrap_or_default();
            let (_, _, reverse_adj) = load_adjacency(graph_id, storage).await?;

            for edge in reverse_adj.get(&input.symbol).unwrap_or(&vec![]) {
                if let Some(ref f) = edge_filter {
                    if !f.contains(&edge.kind) { continue; }
                }
                all_dependents.push(json!({
                    "symbol": edge.from,
                    "edgeKind": edge.kind,
                    "graphId": graph_id,
                }));
            }
        }

        Ok(DependenceGraphQueryDependentsOutput::Ok {
            dependents: serde_json::to_string(&all_dependents)?,
        })
    }

    async fn query_dependencies(
        &self,
        input: DependenceGraphQueryDependenciesInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DependenceGraphQueryDependenciesOutput, Box<dyn std::error::Error>> {
        let edge_filter = parse_edge_kinds(&input.edge_kinds);
        let graphs = storage.find("dependence-graph", None).await?;
        let mut all_deps = Vec::new();

        for graph in &graphs {
            let graph_id = graph.get("id").and_then(|v| v.as_str()).unwrap_or_default();
            let (_, adj, _) = load_adjacency(graph_id, storage).await?;

            for edge in adj.get(&input.symbol).unwrap_or(&vec![]) {
                if let Some(ref f) = edge_filter {
                    if !f.contains(&edge.kind) { continue; }
                }
                all_deps.push(json!({
                    "symbol": edge.to,
                    "edgeKind": edge.kind,
                    "graphId": graph_id,
                }));
            }
        }

        Ok(DependenceGraphQueryDependenciesOutput::Ok {
            dependencies: serde_json::to_string(&all_deps)?,
        })
    }

    async fn slice_forward(
        &self,
        input: DependenceGraphSliceForwardInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DependenceGraphSliceForwardOutput, Box<dyn std::error::Error>> {
        let graphs = storage.find("dependence-graph", None).await?;
        let mut all_nodes = HashSet::new();
        let mut all_edges = Vec::new();

        for graph in &graphs {
            let graph_id = graph.get("id").and_then(|v| v.as_str()).unwrap_or_default();
            let (_, _, reverse_adj) = load_adjacency(graph_id, storage).await?;
            let (reachable, traversed) = transitive_backward(&[input.criterion.clone()], &reverse_adj, &None);
            all_nodes.extend(reachable);
            all_edges.extend(traversed);
        }

        Ok(DependenceGraphSliceForwardOutput::Ok {
            slice: serde_json::to_string(&all_nodes.iter().collect::<Vec<_>>())?,
            edges: serde_json::to_string(&edges_to_json(&all_edges))?,
        })
    }

    async fn slice_backward(
        &self,
        input: DependenceGraphSliceBackwardInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DependenceGraphSliceBackwardOutput, Box<dyn std::error::Error>> {
        let graphs = storage.find("dependence-graph", None).await?;
        let mut all_nodes = HashSet::new();
        let mut all_edges = Vec::new();

        for graph in &graphs {
            let graph_id = graph.get("id").and_then(|v| v.as_str()).unwrap_or_default();
            let (_, adj, _) = load_adjacency(graph_id, storage).await?;
            let (reachable, traversed) = transitive_forward(&[input.criterion.clone()], &adj, &None);
            all_nodes.extend(reachable);
            all_edges.extend(traversed);
        }

        Ok(DependenceGraphSliceBackwardOutput::Ok {
            slice: serde_json::to_string(&all_nodes.iter().collect::<Vec<_>>())?,
            edges: serde_json::to_string(&edges_to_json(&all_edges))?,
        })
    }

    async fn impact_analysis(
        &self,
        input: DependenceGraphImpactAnalysisInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DependenceGraphImpactAnalysisOutput, Box<dyn std::error::Error>> {
        let changed_symbols: Vec<String> = serde_json::from_str(&input.changed)
            .unwrap_or_else(|_| input.changed.split(',').map(|s| s.trim().to_string()).collect());

        let graphs = storage.find("dependence-graph", None).await?;
        let mut affected = HashSet::new();
        let mut all_paths = Vec::new();

        for graph in &graphs {
            let graph_id = graph.get("id").and_then(|v| v.as_str()).unwrap_or_default();
            let (_, _, reverse_adj) = load_adjacency(graph_id, storage).await?;
            let (reachable, traversed) = transitive_backward(&changed_symbols, &reverse_adj, &None);
            affected.extend(reachable);
            for edge in &traversed {
                all_paths.push(json!({"from": edge.from, "to": edge.to, "kind": edge.kind}));
            }
        }

        // Remove the changed symbols themselves
        for s in &changed_symbols {
            affected.remove(s);
        }

        Ok(DependenceGraphImpactAnalysisOutput::Ok {
            affected: serde_json::to_string(&affected.iter().collect::<Vec<_>>())?,
            paths: serde_json::to_string(&all_paths)?,
        })
    }

    async fn get(
        &self,
        input: DependenceGraphGetInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DependenceGraphGetOutput, Box<dyn std::error::Error>> {
        let record = storage.get("dependence-graph", &input.graph).await?;
        let record = match record {
            Some(r) => r,
            None => return Ok(DependenceGraphGetOutput::Notfound),
        };

        let edges = storage.find("dependence-graph-edge", Some(&json!({"graphId": input.graph}))).await?;
        let mut nodes = HashSet::new();
        for edge in &edges {
            if let Some(from) = edge.get("from").and_then(|v| v.as_str()) {
                nodes.insert(from.to_string());
            }
            if let Some(to) = edge.get("to").and_then(|v| v.as_str()) {
                nodes.insert(to.to_string());
            }
        }

        Ok(DependenceGraphGetOutput::Ok {
            graph: record.get("id").and_then(|v| v.as_str()).unwrap_or_default().to_string(),
            scope: record.get("scope").and_then(|v| v.as_str()).unwrap_or_default().to_string(),
            node_count: nodes.len() as i64,
            edge_count: edges.len() as i64,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_compute_file_scope() {
        let storage = InMemoryStorage::new();
        let handler = DependenceGraphHandlerImpl;
        let result = handler.compute(
            DependenceGraphComputeInput {
                scope_ref: "src/main.ts".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            DependenceGraphComputeOutput::Ok { graph } => {
                assert!(!graph.is_empty());
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_query_dependents_empty() {
        let storage = InMemoryStorage::new();
        let handler = DependenceGraphHandlerImpl;
        let result = handler.query_dependents(
            DependenceGraphQueryDependentsInput {
                symbol: "foo".to_string(),
                edge_kinds: "".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            DependenceGraphQueryDependentsOutput::Ok { dependents } => {
                assert_eq!(dependents, "[]");
            },
        }
    }

    #[tokio::test]
    async fn test_query_dependencies_empty() {
        let storage = InMemoryStorage::new();
        let handler = DependenceGraphHandlerImpl;
        let result = handler.query_dependencies(
            DependenceGraphQueryDependenciesInput {
                symbol: "foo".to_string(),
                edge_kinds: "".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            DependenceGraphQueryDependenciesOutput::Ok { dependencies } => {
                assert_eq!(dependencies, "[]");
            },
        }
    }

    #[tokio::test]
    async fn test_get_not_found() {
        let storage = InMemoryStorage::new();
        let handler = DependenceGraphHandlerImpl;
        let result = handler.get(
            DependenceGraphGetInput {
                graph: "nonexistent".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            DependenceGraphGetOutput::Notfound => {},
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_impact_analysis_empty() {
        let storage = InMemoryStorage::new();
        let handler = DependenceGraphHandlerImpl;
        let result = handler.impact_analysis(
            DependenceGraphImpactAnalysisInput {
                changed: r#"["foo"]"#.to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            DependenceGraphImpactAnalysisOutput::Ok { affected, .. } => {
                assert_eq!(affected, "[]");
            },
        }
    }
}
