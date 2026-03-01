// Ref concept implementation
// Git-like named references (branches, tags) pointing to content hashes.
// Supports create, update with compare-and-swap, delete with protection,
// resolve, and reflog history tracking.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::RefHandler;
use serde_json::json;

pub struct RefHandlerImpl;

const PROTECTED_REFS: &[&str] = &["main", "master", "HEAD"];

fn is_valid_hash(hash: &str) -> bool {
    !hash.is_empty() && hash.len() >= 4
}

#[async_trait]
impl RefHandler for RefHandlerImpl {
    async fn create(
        &self,
        input: RefCreateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<RefCreateOutput, Box<dyn std::error::Error>> {
        if !is_valid_hash(&input.hash) {
            return Ok(RefCreateOutput::InvalidHash {
                message: format!("Hash \"{}\" is invalid or too short", input.hash),
            });
        }

        let existing = storage.get("ref", &input.name).await?;
        if existing.is_some() {
            return Ok(RefCreateOutput::Exists {
                message: format!("Ref \"{}\" already exists", input.name),
            });
        }

        let now = chrono::Utc::now().to_rfc3339();

        storage.put("ref", &input.name, json!({
            "name": input.name,
            "hash": input.hash,
            "createdAt": now,
            "updatedAt": now,
        })).await?;

        // Write initial reflog entry
        let reflog_key = format!("reflog:{}", input.name);
        storage.put("reflog", &reflog_key, json!({
            "ref": input.name,
            "entries": [{
                "oldHash": "0000000000",
                "newHash": input.hash,
                "timestamp": now,
                "agent": "system",
            }],
        })).await?;

        Ok(RefCreateOutput::Ok {
            r#ref: input.name,
        })
    }

    async fn update(
        &self,
        input: RefUpdateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<RefUpdateOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("ref", &input.name).await?;
        let existing = match existing {
            Some(r) => r,
            None => return Ok(RefUpdateOutput::NotFound {
                message: format!("Ref \"{}\" not found", input.name),
            }),
        };

        let current_hash = existing.get("hash").and_then(|v| v.as_str()).unwrap_or("").to_string();

        // Compare-and-swap: verify expected old hash matches current
        if current_hash != input.expected_old_hash {
            return Ok(RefUpdateOutput::Conflict {
                current: current_hash,
            });
        }

        let now = chrono::Utc::now().to_rfc3339();

        storage.put("ref", &input.name, json!({
            "name": input.name,
            "hash": input.new_hash,
            "createdAt": existing.get("createdAt"),
            "updatedAt": now,
        })).await?;

        // Append reflog entry
        let reflog_key = format!("reflog:{}", input.name);
        let reflog = storage.get("reflog", &reflog_key).await?;
        let mut entries = if let Some(ref r) = reflog {
            r.get("entries").and_then(|v| v.as_array()).cloned().unwrap_or_default()
        } else {
            Vec::new()
        };
        entries.push(json!({
            "oldHash": current_hash,
            "newHash": input.new_hash,
            "timestamp": now,
            "agent": "system",
        }));
        storage.put("reflog", &reflog_key, json!({
            "ref": input.name,
            "entries": entries,
        })).await?;

        Ok(RefUpdateOutput::Ok)
    }

    async fn delete(
        &self,
        input: RefDeleteInput,
        storage: &dyn ConceptStorage,
    ) -> Result<RefDeleteOutput, Box<dyn std::error::Error>> {
        if PROTECTED_REFS.contains(&input.name.as_str()) {
            return Ok(RefDeleteOutput::Protected {
                message: format!("Ref \"{}\" is protected and cannot be deleted", input.name),
            });
        }

        let existing = storage.get("ref", &input.name).await?;
        if existing.is_none() {
            return Ok(RefDeleteOutput::NotFound {
                message: format!("Ref \"{}\" not found", input.name),
            });
        }

        storage.del("ref", &input.name).await?;

        Ok(RefDeleteOutput::Ok)
    }

    async fn resolve(
        &self,
        input: RefResolveInput,
        storage: &dyn ConceptStorage,
    ) -> Result<RefResolveOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("ref", &input.name).await?;
        match existing {
            Some(r) => {
                let hash = r.get("hash").and_then(|v| v.as_str()).unwrap_or("").to_string();
                Ok(RefResolveOutput::Ok { hash })
            }
            None => Ok(RefResolveOutput::NotFound {
                message: format!("Ref \"{}\" not found", input.name),
            }),
        }
    }

    async fn log(
        &self,
        input: RefLogInput,
        storage: &dyn ConceptStorage,
    ) -> Result<RefLogOutput, Box<dyn std::error::Error>> {
        let reflog_key = format!("reflog:{}", input.name);
        let reflog = storage.get("reflog", &reflog_key).await?;

        match reflog {
            Some(r) => {
                let entries_str = serde_json::to_string(
                    r.get("entries").unwrap_or(&json!([]))
                )?;
                Ok(RefLogOutput::Ok {
                    entries: serde_json::from_str(&entries_str)?,
                })
            }
            None => Ok(RefLogOutput::NotFound {
                message: format!("No reflog for \"{}\"", input.name),
            }),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_create_ref() {
        let storage = InMemoryStorage::new();
        let handler = RefHandlerImpl;
        let result = handler.create(
            RefCreateInput { name: "feature-branch".to_string(), hash: "abc123def456".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            RefCreateOutput::Ok { r#ref } => assert_eq!(r#ref, "feature-branch"),
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_create_ref_invalid_hash() {
        let storage = InMemoryStorage::new();
        let handler = RefHandlerImpl;
        let result = handler.create(
            RefCreateInput { name: "branch".to_string(), hash: "ab".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            RefCreateOutput::InvalidHash { .. } => {}
            _ => panic!("Expected InvalidHash variant"),
        }
    }

    #[tokio::test]
    async fn test_create_ref_exists() {
        let storage = InMemoryStorage::new();
        let handler = RefHandlerImpl;
        handler.create(
            RefCreateInput { name: "branch".to_string(), hash: "abc123def456".to_string() },
            &storage,
        ).await.unwrap();
        let result = handler.create(
            RefCreateInput { name: "branch".to_string(), hash: "def456abc789".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            RefCreateOutput::Exists { .. } => {}
            _ => panic!("Expected Exists variant"),
        }
    }

    #[tokio::test]
    async fn test_resolve_ref() {
        let storage = InMemoryStorage::new();
        let handler = RefHandlerImpl;
        handler.create(
            RefCreateInput { name: "branch".to_string(), hash: "abc123def456".to_string() },
            &storage,
        ).await.unwrap();
        let result = handler.resolve(
            RefResolveInput { name: "branch".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            RefResolveOutput::Ok { hash } => assert_eq!(hash, "abc123def456"),
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_resolve_not_found() {
        let storage = InMemoryStorage::new();
        let handler = RefHandlerImpl;
        let result = handler.resolve(
            RefResolveInput { name: "nonexistent".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            RefResolveOutput::NotFound { .. } => {}
            _ => panic!("Expected NotFound variant"),
        }
    }

    #[tokio::test]
    async fn test_delete_ref() {
        let storage = InMemoryStorage::new();
        let handler = RefHandlerImpl;
        handler.create(
            RefCreateInput { name: "feature".to_string(), hash: "abc123def456".to_string() },
            &storage,
        ).await.unwrap();
        let result = handler.delete(
            RefDeleteInput { name: "feature".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            RefDeleteOutput::Ok => {}
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_delete_protected_ref() {
        let storage = InMemoryStorage::new();
        let handler = RefHandlerImpl;
        let result = handler.delete(
            RefDeleteInput { name: "main".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            RefDeleteOutput::Protected { .. } => {}
            _ => panic!("Expected Protected variant"),
        }
    }

    #[tokio::test]
    async fn test_update_not_found() {
        let storage = InMemoryStorage::new();
        let handler = RefHandlerImpl;
        let result = handler.update(
            RefUpdateInput {
                name: "nonexistent".to_string(),
                new_hash: "newhash123".to_string(),
                expected_old_hash: "oldhash".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            RefUpdateOutput::NotFound { .. } => {}
            _ => panic!("Expected NotFound variant"),
        }
    }
}
