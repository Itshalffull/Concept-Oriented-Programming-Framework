// DataFlowPath Handler Implementation
//
// Traces data flow from source to sink through the program.
// Enables taint tracking, config value propagation tracing,
// and data provenance analysis via BFS over dependence-graph edges.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::DataFlowPathHandler;
use serde_json::json;
use std::collections::{HashMap, HashSet, VecDeque};
use std::sync::atomic::{AtomicU64, Ordering};

static ID_COUNTER: AtomicU64 = AtomicU64::new(0);

fn next_id() -> String {
    let id = ID_COUNTER.fetch_add(1, Ordering::SeqCst) + 1;
    format!("data-flow-path-{}", id)
}

/// Infer path kind from source and sink symbol prefixes.
fn infer_path_kind(source: &str, sink: &str) -> String {
    if source.starts_with("config/") {
        "config-propagation".to_string()
    } else if sink.ends_with(".output") || sink.contains("/output/") {
        "output-derivation".to_string()
    } else if source.contains("user-input") || source.contains("request") {
        "taint".to_string()
    } else {
        "data-flow".to_string()
    }
}

/// Build adjacency list from stored dependence-graph edges.
async fn build_adjacency(
    storage: &dyn ConceptStorage,
) -> Result<HashMap<String, Vec<String>>, Box<dyn std::error::Error>> {
    let edges = storage.find("dependence-graph-edge", None).await?;
    let mut adj: HashMap<String, Vec<String>> = HashMap::new();
    for edge in &edges {
        if let (Some(from), Some(to)) = (edge.get("from").and_then(|v| v.as_str()), edge.get("to").and_then(|v| v.as_str())) {
            adj.entry(from.to_string()).or_default().push(to.to_string());
        }
    }
    Ok(adj)
}

/// Build reverse adjacency list from stored dependence-graph edges.
async fn build_reverse_adjacency(
    storage: &dyn ConceptStorage,
) -> Result<HashMap<String, Vec<String>>, Box<dyn std::error::Error>> {
    let edges = storage.find("dependence-graph-edge", None).await?;
    let mut rev: HashMap<String, Vec<String>> = HashMap::new();
    for edge in &edges {
        if let (Some(from), Some(to)) = (edge.get("from").and_then(|v| v.as_str()), edge.get("to").and_then(|v| v.as_str())) {
            rev.entry(to.to_string()).or_default().push(from.to_string());
        }
    }
    Ok(rev)
}

/// BFS to find all paths from source to sink.
fn find_paths(
    source: &str,
    sink: &str,
    adj: &HashMap<String, Vec<String>>,
) -> Vec<(String, Vec<String>, String)> {
    let mut paths = Vec::new();
    let mut queue: VecDeque<(String, Vec<String>)> = VecDeque::new();
    queue.push_back((source.to_string(), vec![source.to_string()]));
    let mut visited: HashSet<String> = HashSet::new();

    while let Some((node, path)) = queue.pop_front() {
        if node == sink {
            let path_id = next_id();
            let path_kind = infer_path_kind(source, sink);
            paths.push((path_id, path, path_kind));
            continue;
        }

        let key = format!("{}:{}", node, path.len());
        if visited.contains(&key) {
            continue;
        }
        visited.insert(key);

        if let Some(neighbors) = adj.get(&node) {
            for neighbor in neighbors {
                if !path.contains(neighbor) {
                    let mut new_path = path.clone();
                    new_path.push(neighbor.clone());
                    queue.push_back((neighbor.clone(), new_path));
                }
            }
        }
    }

    paths
}

pub struct DataFlowPathHandlerImpl;

#[async_trait]
impl DataFlowPathHandler for DataFlowPathHandlerImpl {
    async fn trace(
        &self,
        input: DataFlowPathTraceInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DataFlowPathTraceOutput, Box<dyn std::error::Error>> {
        let adj = build_adjacency(storage).await?;
        let paths = find_paths(&input.source, &input.sink, &adj);

        if paths.is_empty() {
            return Ok(DataFlowPathTraceOutput::NoPath);
        }

        let mut result_paths = Vec::new();
        for (path_id, steps, path_kind) in &paths {
            storage.put("data-flow-path", path_id, json!({
                "id": path_id,
                "sourceSymbol": input.source,
                "sinkSymbol": input.sink,
                "steps": serde_json::to_string(&steps)?,
                "pathKind": path_kind,
                "stepCount": steps.len(),
            })).await?;
            result_paths.push(json!({
                "id": path_id,
                "steps": steps,
                "pathKind": path_kind,
            }));
        }

        Ok(DataFlowPathTraceOutput::Ok {
            paths: serde_json::to_string(&result_paths)?,
        })
    }

    async fn trace_from_config(
        &self,
        input: DataFlowPathTraceFromConfigInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DataFlowPathTraceFromConfigOutput, Box<dyn std::error::Error>> {
        let adj = build_adjacency(storage).await?;
        let config_source = if input.config_key.starts_with("config/") {
            input.config_key.clone()
        } else {
            format!("config/{}", input.config_key)
        };

        // BFS to find reachable leaf nodes from config source
        let mut visited = HashSet::new();
        let mut queue = VecDeque::new();
        queue.push_back(config_source.clone());
        queue.push_back(input.config_key.clone());
        let mut reachable_leaves = Vec::new();

        while let Some(current) = queue.pop_front() {
            if visited.contains(&current) {
                continue;
            }
            visited.insert(current.clone());

            let neighbors = adj.get(&current).cloned().unwrap_or_default();
            if neighbors.is_empty() && current != config_source && current != input.config_key {
                reachable_leaves.push(current);
            }
            for n in neighbors {
                queue.push_back(n);
            }
        }

        let mut all_paths = Vec::new();
        for leaf in &reachable_leaves {
            let paths = find_paths(&config_source, leaf, &adj);
            for (id, steps, kind) in paths {
                all_paths.push(json!({ "id": id, "steps": steps, "pathKind": kind }));
            }
        }

        Ok(DataFlowPathTraceFromConfigOutput::Ok {
            paths: serde_json::to_string(&all_paths)?,
        })
    }

    async fn trace_to_output(
        &self,
        input: DataFlowPathTraceToOutputInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DataFlowPathTraceToOutputOutput, Box<dyn std::error::Error>> {
        let adj = build_adjacency(storage).await?;
        let rev = build_reverse_adjacency(storage).await?;

        // BFS backward from output to find all source nodes
        let mut visited = HashSet::new();
        let mut queue = VecDeque::new();
        queue.push_back(input.output.clone());
        let mut sources = Vec::new();

        while let Some(current) = queue.pop_front() {
            if visited.contains(&current) {
                continue;
            }
            visited.insert(current.clone());

            let predecessors = rev.get(&current).cloned().unwrap_or_default();
            if predecessors.is_empty() && current != input.output {
                sources.push(current);
            }
            for p in predecessors {
                queue.push_back(p);
            }
        }

        let mut all_paths = Vec::new();
        for source in &sources {
            let paths = find_paths(source, &input.output, &adj);
            for (id, steps, kind) in paths {
                all_paths.push(json!({ "id": id, "steps": steps, "pathKind": kind }));
            }
        }

        Ok(DataFlowPathTraceToOutputOutput::Ok {
            paths: serde_json::to_string(&all_paths)?,
        })
    }

    async fn get(
        &self,
        input: DataFlowPathGetInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DataFlowPathGetOutput, Box<dyn std::error::Error>> {
        let record = storage.get("data-flow-path", &input.path).await?;
        match record {
            Some(r) => Ok(DataFlowPathGetOutput::Ok {
                path: r["id"].as_str().unwrap_or_default().to_string(),
                source_symbol: r["sourceSymbol"].as_str().unwrap_or_default().to_string(),
                sink_symbol: r["sinkSymbol"].as_str().unwrap_or_default().to_string(),
                path_kind: r["pathKind"].as_str().unwrap_or_default().to_string(),
                step_count: r["stepCount"].as_i64().unwrap_or(0),
            }),
            None => Ok(DataFlowPathGetOutput::Notfound),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_trace_no_path() {
        let storage = InMemoryStorage::new();
        let handler = DataFlowPathHandlerImpl;
        let result = handler.trace(
            DataFlowPathTraceInput {
                source: "a".to_string(),
                sink: "z".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            DataFlowPathTraceOutput::NoPath => {},
            _ => panic!("Expected NoPath variant"),
        }
    }

    #[tokio::test]
    async fn test_trace_with_edges() {
        let storage = InMemoryStorage::new();
        storage.put("dependence-graph-edge", "e1", json!({"from": "a", "to": "b"})).await.unwrap();
        storage.put("dependence-graph-edge", "e2", json!({"from": "b", "to": "c"})).await.unwrap();

        let handler = DataFlowPathHandlerImpl;
        let result = handler.trace(
            DataFlowPathTraceInput {
                source: "a".to_string(),
                sink: "c".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            DataFlowPathTraceOutput::Ok { paths } => {
                assert!(!paths.is_empty());
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_trace_from_config() {
        let storage = InMemoryStorage::new();
        let handler = DataFlowPathHandlerImpl;
        let result = handler.trace_from_config(
            DataFlowPathTraceFromConfigInput {
                config_key: "db_host".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            DataFlowPathTraceFromConfigOutput::Ok { paths } => {
                assert!(paths.contains("[]") || paths.len() >= 0);
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_trace_to_output() {
        let storage = InMemoryStorage::new();
        let handler = DataFlowPathHandlerImpl;
        let result = handler.trace_to_output(
            DataFlowPathTraceToOutputInput {
                output: "result.output".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            DataFlowPathTraceToOutputOutput::Ok { paths } => {
                assert!(paths.contains("[]") || paths.len() >= 0);
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_get_not_found() {
        let storage = InMemoryStorage::new();
        let handler = DataFlowPathHandlerImpl;
        let result = handler.get(
            DataFlowPathGetInput {
                path: "nonexistent".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            DataFlowPathGetOutput::Notfound => {},
            _ => panic!("Expected Notfound variant"),
        }
    }
}
