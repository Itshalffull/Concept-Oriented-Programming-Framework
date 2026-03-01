// Kind system implementation
// Type-level routing graph: defines kinds (typed categories),
// connects them with directed edges (relations/transforms),
// validates connections, finds paths, and queries dependents.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::KindSystemHandler;
use serde_json::json;

pub struct KindSystemHandlerImpl;

#[async_trait]
impl KindSystemHandler for KindSystemHandlerImpl {
    async fn define(
        &self,
        input: KindSystemDefineInput,
        storage: &dyn ConceptStorage,
    ) -> Result<KindSystemDefineOutput, Box<dyn std::error::Error>> {
        if let Some(_existing) = storage.get("kind", &input.name).await? {
            return Ok(KindSystemDefineOutput::Exists { kind: input.name });
        }

        storage.put("kind", &input.name, json!({
            "name": input.name,
            "category": input.category,
        })).await?;

        Ok(KindSystemDefineOutput::Ok { kind: input.name })
    }

    async fn connect(
        &self,
        input: KindSystemConnectInput,
        storage: &dyn ConceptStorage,
    ) -> Result<KindSystemConnectOutput, Box<dyn std::error::Error>> {
        let from_exists = storage.get("kind", &input.from).await?.is_some();
        let to_exists = storage.get("kind", &input.to).await?.is_some();

        if !from_exists || !to_exists {
            return Ok(KindSystemConnectOutput::Invalid {
                message: format!("Kind '{}' or '{}' not defined", input.from, input.to),
            });
        }

        let edge_key = format!("{}:{}:{}", input.from, input.to, input.relation);
        storage.put("edge", &edge_key, json!({
            "from": input.from,
            "to": input.to,
            "relation": input.relation,
            "transform": input.transform_name,
        })).await?;

        Ok(KindSystemConnectOutput::Ok)
    }

    async fn route(
        &self,
        input: KindSystemRouteInput,
        storage: &dyn ConceptStorage,
    ) -> Result<KindSystemRouteOutput, Box<dyn std::error::Error>> {
        let edges = storage.find("edge", None).await?;

        // BFS to find shortest path from -> to
        let mut queue = std::collections::VecDeque::new();
        let mut visited = std::collections::HashSet::new();
        let mut parent: std::collections::HashMap<String, (String, String, Option<String>)> =
            std::collections::HashMap::new();

        queue.push_back(input.from.clone());
        visited.insert(input.from.clone());

        while let Some(current) = queue.pop_front() {
            if current == input.to {
                let mut path = Vec::new();
                let mut node = input.to.clone();
                while let Some((prev, rel, transform)) = parent.get(&node) {
                    path.push(json!({
                        "kind": node,
                        "relation": rel,
                        "transform": transform,
                    }));
                    node = prev.clone();
                }
                path.reverse();
                return Ok(KindSystemRouteOutput::Ok { path });
            }

            for edge in &edges {
                let from = edge.get("from").and_then(|v| v.as_str()).unwrap_or("");
                let to = edge.get("to").and_then(|v| v.as_str()).unwrap_or("");
                let relation = edge.get("relation").and_then(|v| v.as_str()).unwrap_or("");
                let transform = edge.get("transform").and_then(|v| v.as_str()).map(|s| s.to_string());

                if from == current && !visited.contains(to) {
                    visited.insert(to.to_string());
                    parent.insert(to.to_string(), (current.clone(), relation.to_string(), transform));
                    queue.push_back(to.to_string());
                }
            }
        }

        Ok(KindSystemRouteOutput::Unreachable {
            message: format!("No path from '{}' to '{}'", input.from, input.to),
        })
    }

    async fn validate(
        &self,
        input: KindSystemValidateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<KindSystemValidateOutput, Box<dyn std::error::Error>> {
        let from_exists = storage.get("kind", &input.from).await?.is_some();
        let to_exists = storage.get("kind", &input.to).await?.is_some();

        if !from_exists {
            return Ok(KindSystemValidateOutput::Invalid {
                message: format!("Kind '{}' not defined", input.from),
            });
        }
        if !to_exists {
            return Ok(KindSystemValidateOutput::Invalid {
                message: format!("Kind '{}' not defined", input.to),
            });
        }

        Ok(KindSystemValidateOutput::Ok)
    }

    async fn dependents(
        &self,
        input: KindSystemDependentsInput,
        storage: &dyn ConceptStorage,
    ) -> Result<KindSystemDependentsOutput, Box<dyn std::error::Error>> {
        let edges = storage.find("edge", None).await?;
        let downstream: Vec<String> = edges.iter()
            .filter(|e| e.get("from").and_then(|v| v.as_str()) == Some(&input.kind.as_str()))
            .filter_map(|e| e.get("to").and_then(|v| v.as_str()).map(|s| s.to_string()))
            .collect();

        Ok(KindSystemDependentsOutput::Ok { downstream })
    }

    async fn producers(
        &self,
        input: KindSystemProducersInput,
        storage: &dyn ConceptStorage,
    ) -> Result<KindSystemProducersOutput, Box<dyn std::error::Error>> {
        let edges = storage.find("edge", None).await?;
        let transforms: Vec<serde_json::Value> = edges.iter()
            .filter(|e| e.get("to").and_then(|v| v.as_str()) == Some(&input.kind.as_str()))
            .map(|e| json!({
                "from_kind": e.get("from").and_then(|v| v.as_str()).unwrap_or(""),
                "transform_name": e.get("transform").and_then(|v| v.as_str()),
            }))
            .collect();

        Ok(KindSystemProducersOutput::Ok { transforms })
    }

    async fn consumers(
        &self,
        input: KindSystemConsumersInput,
        storage: &dyn ConceptStorage,
    ) -> Result<KindSystemConsumersOutput, Box<dyn std::error::Error>> {
        let edges = storage.find("edge", None).await?;
        let transforms: Vec<serde_json::Value> = edges.iter()
            .filter(|e| e.get("from").and_then(|v| v.as_str()) == Some(&input.kind.as_str()))
            .map(|e| json!({
                "to_kind": e.get("to").and_then(|v| v.as_str()).unwrap_or(""),
                "transform_name": e.get("transform").and_then(|v| v.as_str()),
            }))
            .collect();

        Ok(KindSystemConsumersOutput::Ok { transforms })
    }

    async fn graph(
        &self,
        _input: KindSystemGraphInput,
        storage: &dyn ConceptStorage,
    ) -> Result<KindSystemGraphOutput, Box<dyn std::error::Error>> {
        let kinds_data = storage.find("kind", None).await?;
        let edges_data = storage.find("edge", None).await?;

        let kinds: Vec<serde_json::Value> = kinds_data.iter()
            .map(|k| json!({
                "name": k.get("name").and_then(|v| v.as_str()).unwrap_or(""),
                "category": k.get("category").and_then(|v| v.as_str()).unwrap_or(""),
            }))
            .collect();

        let edges: Vec<serde_json::Value> = edges_data.iter()
            .map(|e| json!({
                "from": e.get("from").and_then(|v| v.as_str()).unwrap_or(""),
                "to": e.get("to").and_then(|v| v.as_str()).unwrap_or(""),
                "relation": e.get("relation").and_then(|v| v.as_str()).unwrap_or(""),
                "transform": e.get("transform").and_then(|v| v.as_str()),
            }))
            .collect();

        Ok(KindSystemGraphOutput::Ok { kinds, edges })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_define_kind() {
        let storage = InMemoryStorage::new();
        let handler = KindSystemHandlerImpl;
        let result = handler.define(
            KindSystemDefineInput { name: "ConceptSpec".into(), category: "source".into() },
            &storage,
        ).await.unwrap();
        match result {
            KindSystemDefineOutput::Ok { kind } => assert_eq!(kind, "ConceptSpec"),
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_define_duplicate_kind() {
        let storage = InMemoryStorage::new();
        let handler = KindSystemHandlerImpl;
        handler.define(
            KindSystemDefineInput { name: "ConceptSpec".into(), category: "source".into() },
            &storage,
        ).await.unwrap();
        let result = handler.define(
            KindSystemDefineInput { name: "ConceptSpec".into(), category: "source".into() },
            &storage,
        ).await.unwrap();
        match result {
            KindSystemDefineOutput::Exists { kind } => assert_eq!(kind, "ConceptSpec"),
            _ => panic!("Expected Exists variant"),
        }
    }

    #[tokio::test]
    async fn test_connect_success() {
        let storage = InMemoryStorage::new();
        let handler = KindSystemHandlerImpl;
        handler.define(KindSystemDefineInput { name: "A".into(), category: "src".into() }, &storage).await.unwrap();
        handler.define(KindSystemDefineInput { name: "B".into(), category: "dst".into() }, &storage).await.unwrap();
        let result = handler.connect(
            KindSystemConnectInput { from: "A".into(), to: "B".into(), relation: "produces".into(), transform_name: None },
            &storage,
        ).await.unwrap();
        match result {
            KindSystemConnectOutput::Ok => {}
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_connect_invalid() {
        let storage = InMemoryStorage::new();
        let handler = KindSystemHandlerImpl;
        let result = handler.connect(
            KindSystemConnectInput { from: "X".into(), to: "Y".into(), relation: "r".into(), transform_name: None },
            &storage,
        ).await.unwrap();
        match result {
            KindSystemConnectOutput::Invalid { .. } => {}
            _ => panic!("Expected Invalid variant"),
        }
    }

    #[tokio::test]
    async fn test_validate_both_exist() {
        let storage = InMemoryStorage::new();
        let handler = KindSystemHandlerImpl;
        handler.define(KindSystemDefineInput { name: "A".into(), category: "x".into() }, &storage).await.unwrap();
        handler.define(KindSystemDefineInput { name: "B".into(), category: "y".into() }, &storage).await.unwrap();
        let result = handler.validate(
            KindSystemValidateInput { from: "A".into(), to: "B".into() },
            &storage,
        ).await.unwrap();
        match result {
            KindSystemValidateOutput::Ok => {}
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_validate_missing_kind() {
        let storage = InMemoryStorage::new();
        let handler = KindSystemHandlerImpl;
        let result = handler.validate(
            KindSystemValidateInput { from: "Missing".into(), to: "Also".into() },
            &storage,
        ).await.unwrap();
        match result {
            KindSystemValidateOutput::Invalid { .. } => {}
            _ => panic!("Expected Invalid variant"),
        }
    }

    #[tokio::test]
    async fn test_route_unreachable() {
        let storage = InMemoryStorage::new();
        let handler = KindSystemHandlerImpl;
        handler.define(KindSystemDefineInput { name: "A".into(), category: "x".into() }, &storage).await.unwrap();
        handler.define(KindSystemDefineInput { name: "B".into(), category: "y".into() }, &storage).await.unwrap();
        let result = handler.route(
            KindSystemRouteInput { from: "A".into(), to: "B".into() },
            &storage,
        ).await.unwrap();
        match result {
            KindSystemRouteOutput::Unreachable { .. } => {}
            _ => panic!("Expected Unreachable variant"),
        }
    }

    #[tokio::test]
    async fn test_dependents_empty() {
        let storage = InMemoryStorage::new();
        let handler = KindSystemHandlerImpl;
        let result = handler.dependents(
            KindSystemDependentsInput { kind: "A".into() },
            &storage,
        ).await.unwrap();
        match result {
            KindSystemDependentsOutput::Ok { downstream } => assert!(downstream.is_empty()),
        }
    }

    #[tokio::test]
    async fn test_graph_empty() {
        let storage = InMemoryStorage::new();
        let handler = KindSystemHandlerImpl;
        let result = handler.graph(
            KindSystemGraphInput {},
            &storage,
        ).await.unwrap();
        match result {
            KindSystemGraphOutput::Ok { kinds, edges } => {
                assert!(kinds.is_empty());
                assert!(edges.is_empty());
            }
        }
    }
}
