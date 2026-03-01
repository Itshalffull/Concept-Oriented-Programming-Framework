// Symbol relationship graph: tracks directed relationships between symbols
// (inherits, implements, calls, uses, imports). Supports transitive closure
// computation for dependency analysis and impact assessment.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::SymbolRelationshipHandler;
use serde_json::json;

pub struct SymbolRelationshipHandlerImpl;

fn generate_relationship_id(source: &str, target: &str, kind: &str) -> String {
    format!("rel-{}-{}-{}", source, target, kind)
}

#[async_trait]
impl SymbolRelationshipHandler for SymbolRelationshipHandlerImpl {
    async fn add(
        &self,
        input: SymbolRelationshipAddInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SymbolRelationshipAddOutput, Box<dyn std::error::Error>> {
        let rel_id = generate_relationship_id(&input.source, &input.target, &input.kind);

        // Check for existing relationship
        let existing = storage.get("symbolRelationship", &rel_id).await?;
        if let Some(_) = existing {
            return Ok(SymbolRelationshipAddOutput::AlreadyExists {
                existing: rel_id,
            });
        }

        storage.put("symbolRelationship", &rel_id, json!({
            "relationshipId": &rel_id,
            "source": &input.source,
            "target": &input.target,
            "kind": &input.kind,
            "metadata": "{}",
        })).await?;

        // Index by source for find_from
        let from_key = format!("from-{}-{}", &input.source, &input.kind);
        let from_index = storage.get("relFromIndex", &from_key).await?;
        let mut rels: Vec<String> = from_index
            .and_then(|v| serde_json::from_value(v["relationships"].clone()).ok())
            .unwrap_or_default();
        if !rels.contains(&rel_id) {
            rels.push(rel_id.clone());
        }
        storage.put("relFromIndex", &from_key, json!({"relationships": rels})).await?;

        // Index by target for find_to
        let to_key = format!("to-{}-{}", &input.target, &input.kind);
        let to_index = storage.get("relToIndex", &to_key).await?;
        let mut to_rels: Vec<String> = to_index
            .and_then(|v| serde_json::from_value(v["relationships"].clone()).ok())
            .unwrap_or_default();
        if !to_rels.contains(&rel_id) {
            to_rels.push(rel_id.clone());
        }
        storage.put("relToIndex", &to_key, json!({"relationships": to_rels})).await?;

        Ok(SymbolRelationshipAddOutput::Ok { relationship: rel_id })
    }

    async fn find_from(
        &self,
        input: SymbolRelationshipFindFromInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SymbolRelationshipFindFromOutput, Box<dyn std::error::Error>> {
        let from_key = format!("from-{}-{}", &input.source, &input.kind);
        let from_index = storage.get("relFromIndex", &from_key).await?;
        let rels: Vec<String> = from_index
            .and_then(|v| serde_json::from_value(v["relationships"].clone()).ok())
            .unwrap_or_default();

        Ok(SymbolRelationshipFindFromOutput::Ok {
            relationships: serde_json::to_string(&rels).unwrap_or_else(|_| "[]".to_string()),
        })
    }

    async fn find_to(
        &self,
        input: SymbolRelationshipFindToInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SymbolRelationshipFindToOutput, Box<dyn std::error::Error>> {
        let to_key = format!("to-{}-{}", &input.target, &input.kind);
        let to_index = storage.get("relToIndex", &to_key).await?;
        let rels: Vec<String> = to_index
            .and_then(|v| serde_json::from_value(v["relationships"].clone()).ok())
            .unwrap_or_default();

        Ok(SymbolRelationshipFindToOutput::Ok {
            relationships: serde_json::to_string(&rels).unwrap_or_else(|_| "[]".to_string()),
        })
    }

    async fn transitive_closure(
        &self,
        input: SymbolRelationshipTransitiveClosureInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SymbolRelationshipTransitiveClosureOutput, Box<dyn std::error::Error>> {
        let mut visited = std::collections::HashSet::new();
        let mut queue = std::collections::VecDeque::new();
        let mut paths: Vec<Vec<String>> = Vec::new();

        queue.push_back((input.start.clone(), vec![input.start.clone()]));
        visited.insert(input.start.clone());

        while let Some((current, path)) = queue.pop_front() {
            // Find neighbors based on direction
            let index_key = if input.direction == "forward" {
                format!("from-{}-{}", &current, &input.kind)
            } else {
                format!("to-{}-{}", &current, &input.kind)
            };

            let index_name = if input.direction == "forward" { "relFromIndex" } else { "relToIndex" };
            let index = storage.get(index_name, &index_key).await?;
            let rel_ids: Vec<String> = index
                .and_then(|v| serde_json::from_value(v["relationships"].clone()).ok())
                .unwrap_or_default();

            for rel_id in &rel_ids {
                if let Some(record) = storage.get("symbolRelationship", rel_id).await? {
                    let neighbor = if input.direction == "forward" {
                        record["target"].as_str().unwrap_or("").to_string()
                    } else {
                        record["source"].as_str().unwrap_or("").to_string()
                    };

                    if !visited.contains(&neighbor) {
                        visited.insert(neighbor.clone());
                        let mut new_path = path.clone();
                        new_path.push(neighbor.clone());
                        paths.push(new_path.clone());
                        queue.push_back((neighbor, new_path));
                    }
                }
            }
        }

        let symbols: Vec<String> = visited.into_iter().collect();

        Ok(SymbolRelationshipTransitiveClosureOutput::Ok {
            symbols: serde_json::to_string(&symbols).unwrap_or_else(|_| "[]".to_string()),
            paths: serde_json::to_string(&paths).unwrap_or_else(|_| "[]".to_string()),
        })
    }

    async fn get(
        &self,
        input: SymbolRelationshipGetInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SymbolRelationshipGetOutput, Box<dyn std::error::Error>> {
        let record = storage.get("symbolRelationship", &input.relationship).await?;

        match record {
            Some(v) => Ok(SymbolRelationshipGetOutput::Ok {
                relationship: input.relationship,
                source: v["source"].as_str().unwrap_or("").to_string(),
                target: v["target"].as_str().unwrap_or("").to_string(),
                kind: v["kind"].as_str().unwrap_or("").to_string(),
                metadata: v["metadata"].as_str().unwrap_or("{}").to_string(),
            }),
            None => Ok(SymbolRelationshipGetOutput::Notfound),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_add_relationship() {
        let storage = InMemoryStorage::new();
        let handler = SymbolRelationshipHandlerImpl;
        let result = handler.add(
            SymbolRelationshipAddInput {
                source: "sym-a".to_string(),
                target: "sym-b".to_string(),
                kind: "calls".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            SymbolRelationshipAddOutput::Ok { relationship } => {
                assert!(relationship.contains("sym-a"));
                assert!(relationship.contains("sym-b"));
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_add_duplicate() {
        let storage = InMemoryStorage::new();
        let handler = SymbolRelationshipHandlerImpl;
        handler.add(
            SymbolRelationshipAddInput {
                source: "sym-a".to_string(),
                target: "sym-b".to_string(),
                kind: "calls".to_string(),
            },
            &storage,
        ).await.unwrap();
        let result = handler.add(
            SymbolRelationshipAddInput {
                source: "sym-a".to_string(),
                target: "sym-b".to_string(),
                kind: "calls".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            SymbolRelationshipAddOutput::AlreadyExists { .. } => {},
            _ => panic!("Expected AlreadyExists variant"),
        }
    }

    #[tokio::test]
    async fn test_find_from() {
        let storage = InMemoryStorage::new();
        let handler = SymbolRelationshipHandlerImpl;
        handler.add(
            SymbolRelationshipAddInput {
                source: "sym-a".to_string(),
                target: "sym-b".to_string(),
                kind: "calls".to_string(),
            },
            &storage,
        ).await.unwrap();
        let result = handler.find_from(
            SymbolRelationshipFindFromInput { source: "sym-a".to_string(), kind: "calls".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            SymbolRelationshipFindFromOutput::Ok { relationships } => {
                assert!(relationships.contains("rel-"));
            },
        }
    }

    #[tokio::test]
    async fn test_find_to() {
        let storage = InMemoryStorage::new();
        let handler = SymbolRelationshipHandlerImpl;
        handler.add(
            SymbolRelationshipAddInput {
                source: "sym-a".to_string(),
                target: "sym-b".to_string(),
                kind: "inherits".to_string(),
            },
            &storage,
        ).await.unwrap();
        let result = handler.find_to(
            SymbolRelationshipFindToInput { target: "sym-b".to_string(), kind: "inherits".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            SymbolRelationshipFindToOutput::Ok { relationships } => {
                assert!(relationships.contains("rel-"));
            },
        }
    }

    #[tokio::test]
    async fn test_get_existing() {
        let storage = InMemoryStorage::new();
        let handler = SymbolRelationshipHandlerImpl;
        let rel_id = match handler.add(
            SymbolRelationshipAddInput {
                source: "sym-a".to_string(),
                target: "sym-b".to_string(),
                kind: "calls".to_string(),
            },
            &storage,
        ).await.unwrap() {
            SymbolRelationshipAddOutput::Ok { relationship } => relationship,
            _ => panic!("Expected Ok"),
        };
        let result = handler.get(
            SymbolRelationshipGetInput { relationship: rel_id },
            &storage,
        ).await.unwrap();
        match result {
            SymbolRelationshipGetOutput::Ok { source, target, kind, .. } => {
                assert_eq!(source, "sym-a");
                assert_eq!(target, "sym-b");
                assert_eq!(kind, "calls");
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_get_not_found() {
        let storage = InMemoryStorage::new();
        let handler = SymbolRelationshipHandlerImpl;
        let result = handler.get(
            SymbolRelationshipGetInput { relationship: "nonexistent".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            SymbolRelationshipGetOutput::Notfound => {},
            _ => panic!("Expected Notfound variant"),
        }
    }
}
