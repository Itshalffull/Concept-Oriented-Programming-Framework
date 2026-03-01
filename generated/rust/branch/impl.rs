// Branch concept implementation
// Named parallel lines of development with lifecycle management.
// Branches are mutable pointers over immutable DAG history.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::BranchHandler;
use serde_json::json;
use std::collections::HashSet;
use std::sync::atomic::{AtomicU64, Ordering};

static ID_COUNTER: AtomicU64 = AtomicU64::new(0);

fn next_id() -> String {
    let id = ID_COUNTER.fetch_add(1, Ordering::SeqCst) + 1;
    format!("branch-{}", id)
}

pub struct BranchHandlerImpl;

#[async_trait]
impl BranchHandler for BranchHandlerImpl {
    async fn create(
        &self,
        input: BranchCreateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<BranchCreateOutput, Box<dyn std::error::Error>> {
        // Check if branch name already exists
        let existing = storage.find("branch", Some(&json!({ "name": input.name }))).await?;
        if !existing.is_empty() {
            return Ok(BranchCreateOutput::Exists {
                message: format!("Branch '{}' already exists", input.name),
            });
        }

        let id = next_id();
        let now = chrono::Utc::now().to_rfc3339();

        storage.put("branch", &id, json!({
            "id": id,
            "name": input.name,
            "head": input.from_node,
            "protected": false,
            "upstream": null,
            "created": now,
            "archived": false,
        })).await?;

        Ok(BranchCreateOutput::Ok { branch: id })
    }

    async fn advance(
        &self,
        input: BranchAdvanceInput,
        storage: &dyn ConceptStorage,
    ) -> Result<BranchAdvanceOutput, Box<dyn std::error::Error>> {
        let record = storage.get("branch", &input.branch).await?;
        let record = match record {
            Some(r) => r,
            None => return Ok(BranchAdvanceOutput::NotFound {
                message: format!("Branch '{}' not found", input.branch),
            }),
        };

        if record["protected"].as_bool() == Some(true) {
            let name = record["name"].as_str().unwrap_or("");
            return Ok(BranchAdvanceOutput::Protected {
                message: format!("Branch '{}' is protected. Direct advance rejected.", name),
            });
        }

        let mut updated = record.clone();
        updated["head"] = json!(input.new_node);
        storage.put("branch", &input.branch, updated).await?;

        Ok(BranchAdvanceOutput::Ok)
    }

    async fn delete(
        &self,
        input: BranchDeleteInput,
        storage: &dyn ConceptStorage,
    ) -> Result<BranchDeleteOutput, Box<dyn std::error::Error>> {
        let record = storage.get("branch", &input.branch).await?;
        let record = match record {
            Some(r) => r,
            None => return Ok(BranchDeleteOutput::NotFound {
                message: format!("Branch '{}' not found", input.branch),
            }),
        };

        if record["protected"].as_bool() == Some(true) {
            let name = record["name"].as_str().unwrap_or("");
            return Ok(BranchDeleteOutput::Protected {
                message: format!("Protected branch '{}' cannot be deleted", name),
            });
        }

        storage.del("branch", &input.branch).await?;
        Ok(BranchDeleteOutput::Ok)
    }

    async fn protect(
        &self,
        input: BranchProtectInput,
        storage: &dyn ConceptStorage,
    ) -> Result<BranchProtectOutput, Box<dyn std::error::Error>> {
        let record = storage.get("branch", &input.branch).await?;
        let record = match record {
            Some(r) => r,
            None => return Ok(BranchProtectOutput::NotFound {
                message: format!("Branch '{}' not found", input.branch),
            }),
        };

        let mut updated = record.clone();
        updated["protected"] = json!(true);
        storage.put("branch", &input.branch, updated).await?;

        Ok(BranchProtectOutput::Ok)
    }

    async fn set_upstream(
        &self,
        input: BranchSetUpstreamInput,
        storage: &dyn ConceptStorage,
    ) -> Result<BranchSetUpstreamOutput, Box<dyn std::error::Error>> {
        let branch_record = storage.get("branch", &input.branch).await?;
        let branch_record = match branch_record {
            Some(r) => r,
            None => return Ok(BranchSetUpstreamOutput::NotFound {
                message: format!("Branch '{}' not found", input.branch),
            }),
        };

        let upstream_record = storage.get("branch", &input.upstream).await?;
        if upstream_record.is_none() {
            return Ok(BranchSetUpstreamOutput::NotFound {
                message: format!("Upstream branch '{}' not found", input.upstream),
            });
        }

        let mut updated = branch_record.clone();
        updated["upstream"] = json!(input.upstream);
        storage.put("branch", &input.branch, updated).await?;

        Ok(BranchSetUpstreamOutput::Ok)
    }

    async fn divergence_point(
        &self,
        input: BranchDivergencePointInput,
        storage: &dyn ConceptStorage,
    ) -> Result<BranchDivergencePointOutput, Box<dyn std::error::Error>> {
        let branch1 = storage.get("branch", &input.b1).await?;
        let branch1 = match branch1 {
            Some(r) => r,
            None => return Ok(BranchDivergencePointOutput::NotFound {
                message: format!("Branch '{}' not found", input.b1),
            }),
        };

        let branch2 = storage.get("branch", &input.b2).await?;
        let branch2 = match branch2 {
            Some(r) => r,
            None => return Ok(BranchDivergencePointOutput::NotFound {
                message: format!("Branch '{}' not found", input.b2),
            }),
        };

        let head1 = branch1["head"].as_str().unwrap_or("").to_string();
        let head2 = branch2["head"].as_str().unwrap_or("").to_string();

        if head1 == head2 {
            return Ok(BranchDivergencePointOutput::NoDivergence {
                message: "Both branches point to the same node".to_string(),
            });
        }

        // Collect ancestors of head1 via BFS
        let mut ancestors1 = HashSet::new();
        let mut queue1 = vec![head1.clone()];
        while let Some(current) = queue1.pop() {
            if ancestors1.contains(&current) { continue; }
            ancestors1.insert(current.clone());
            if let Some(node) = storage.get("dag-history", &current).await? {
                if let Some(parents) = node["parents"].as_array() {
                    for p in parents {
                        if let Some(parent_id) = p.as_str() {
                            queue1.push(parent_id.to_string());
                        }
                    }
                }
            }
        }

        // Walk head2's ancestors in BFS order
        let mut visited = HashSet::new();
        let mut queue2 = vec![head2.clone()];
        while let Some(current) = queue2.pop() {
            if visited.contains(&current) { continue; }
            visited.insert(current.clone());

            if ancestors1.contains(&current) && current != head1 && current != head2 {
                return Ok(BranchDivergencePointOutput::Ok { node_id: current });
            }

            if let Some(node) = storage.get("dag-history", &current).await? {
                if let Some(parents) = node["parents"].as_array() {
                    for p in parents {
                        if let Some(parent_id) = p.as_str() {
                            queue2.push(parent_id.to_string());
                        }
                    }
                }
            }
        }

        if ancestors1.contains(&head2) {
            return Ok(BranchDivergencePointOutput::NoDivergence {
                message: format!("'{}' is an ancestor of '{}'", input.b2, input.b1),
            });
        }

        Ok(BranchDivergencePointOutput::NoDivergence {
            message: "No divergence point found. One may be a direct ancestor of the other.".to_string(),
        })
    }

    async fn archive(
        &self,
        input: BranchArchiveInput,
        storage: &dyn ConceptStorage,
    ) -> Result<BranchArchiveOutput, Box<dyn std::error::Error>> {
        let record = storage.get("branch", &input.branch).await?;
        let record = match record {
            Some(r) => r,
            None => return Ok(BranchArchiveOutput::NotFound {
                message: format!("Branch '{}' not found", input.branch),
            }),
        };

        let mut updated = record.clone();
        updated["archived"] = json!(true);
        storage.put("branch", &input.branch, updated).await?;

        Ok(BranchArchiveOutput::Ok)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_create_branch() {
        let storage = InMemoryStorage::new();
        let handler = BranchHandlerImpl;
        let result = handler.create(
            BranchCreateInput {
                name: "feature-x".to_string(),
                from_node: "node-0".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            BranchCreateOutput::Ok { branch } => {
                assert!(!branch.is_empty());
            }
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_create_duplicate_branch_returns_exists() {
        let storage = InMemoryStorage::new();
        let handler = BranchHandlerImpl;
        handler.create(
            BranchCreateInput { name: "main".to_string(), from_node: "n0".to_string() },
            &storage,
        ).await.unwrap();
        let result = handler.create(
            BranchCreateInput { name: "main".to_string(), from_node: "n1".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            BranchCreateOutput::Exists { .. } => {}
            _ => panic!("Expected Exists variant"),
        }
    }

    #[tokio::test]
    async fn test_advance_branch() {
        let storage = InMemoryStorage::new();
        let handler = BranchHandlerImpl;
        let create_result = handler.create(
            BranchCreateInput { name: "dev".to_string(), from_node: "n0".to_string() },
            &storage,
        ).await.unwrap();
        let branch_id = match create_result {
            BranchCreateOutput::Ok { branch } => branch,
            _ => panic!("Expected Ok"),
        };
        let result = handler.advance(
            BranchAdvanceInput { branch: branch_id, new_node: "n1".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            BranchAdvanceOutput::Ok => {}
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_advance_not_found() {
        let storage = InMemoryStorage::new();
        let handler = BranchHandlerImpl;
        let result = handler.advance(
            BranchAdvanceInput { branch: "missing".to_string(), new_node: "n1".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            BranchAdvanceOutput::NotFound { .. } => {}
            _ => panic!("Expected NotFound variant"),
        }
    }

    #[tokio::test]
    async fn test_advance_protected_branch_rejected() {
        let storage = InMemoryStorage::new();
        let handler = BranchHandlerImpl;
        let create_result = handler.create(
            BranchCreateInput { name: "protected-br".to_string(), from_node: "n0".to_string() },
            &storage,
        ).await.unwrap();
        let branch_id = match create_result {
            BranchCreateOutput::Ok { branch } => branch,
            _ => panic!("Expected Ok"),
        };
        handler.protect(
            BranchProtectInput { branch: branch_id.clone() },
            &storage,
        ).await.unwrap();
        let result = handler.advance(
            BranchAdvanceInput { branch: branch_id, new_node: "n1".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            BranchAdvanceOutput::Protected { .. } => {}
            _ => panic!("Expected Protected variant"),
        }
    }

    #[tokio::test]
    async fn test_delete_branch() {
        let storage = InMemoryStorage::new();
        let handler = BranchHandlerImpl;
        let create_result = handler.create(
            BranchCreateInput { name: "to-delete".to_string(), from_node: "n0".to_string() },
            &storage,
        ).await.unwrap();
        let branch_id = match create_result {
            BranchCreateOutput::Ok { branch } => branch,
            _ => panic!("Expected Ok"),
        };
        let result = handler.delete(
            BranchDeleteInput { branch: branch_id },
            &storage,
        ).await.unwrap();
        match result {
            BranchDeleteOutput::Ok => {}
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_delete_protected_branch_rejected() {
        let storage = InMemoryStorage::new();
        let handler = BranchHandlerImpl;
        let create_result = handler.create(
            BranchCreateInput { name: "protected-del".to_string(), from_node: "n0".to_string() },
            &storage,
        ).await.unwrap();
        let branch_id = match create_result {
            BranchCreateOutput::Ok { branch } => branch,
            _ => panic!("Expected Ok"),
        };
        handler.protect(
            BranchProtectInput { branch: branch_id.clone() },
            &storage,
        ).await.unwrap();
        let result = handler.delete(
            BranchDeleteInput { branch: branch_id },
            &storage,
        ).await.unwrap();
        match result {
            BranchDeleteOutput::Protected { .. } => {}
            _ => panic!("Expected Protected variant"),
        }
    }

    #[tokio::test]
    async fn test_protect_branch() {
        let storage = InMemoryStorage::new();
        let handler = BranchHandlerImpl;
        let create_result = handler.create(
            BranchCreateInput { name: "to-protect".to_string(), from_node: "n0".to_string() },
            &storage,
        ).await.unwrap();
        let branch_id = match create_result {
            BranchCreateOutput::Ok { branch } => branch,
            _ => panic!("Expected Ok"),
        };
        let result = handler.protect(
            BranchProtectInput { branch: branch_id },
            &storage,
        ).await.unwrap();
        match result {
            BranchProtectOutput::Ok => {}
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_archive_branch() {
        let storage = InMemoryStorage::new();
        let handler = BranchHandlerImpl;
        let create_result = handler.create(
            BranchCreateInput { name: "to-archive".to_string(), from_node: "n0".to_string() },
            &storage,
        ).await.unwrap();
        let branch_id = match create_result {
            BranchCreateOutput::Ok { branch } => branch,
            _ => panic!("Expected Ok"),
        };
        let result = handler.archive(
            BranchArchiveInput { branch: branch_id },
            &storage,
        ).await.unwrap();
        match result {
            BranchArchiveOutput::Ok => {}
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_archive_not_found() {
        let storage = InMemoryStorage::new();
        let handler = BranchHandlerImpl;
        let result = handler.archive(
            BranchArchiveInput { branch: "missing".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            BranchArchiveOutput::NotFound { .. } => {}
            _ => panic!("Expected NotFound variant"),
        }
    }
}
