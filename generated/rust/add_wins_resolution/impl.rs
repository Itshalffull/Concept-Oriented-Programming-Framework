// AddWinsResolution concept implementation
// Add-Wins (OR-Set semantics) conflict resolution. When elements are concurrently
// added and removed, additions win. Suitable for set-like data structures such as
// tags, permissions, and collection membership.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::AddWinsResolutionHandler;
use serde_json::json;
use std::collections::BTreeSet;
use std::sync::atomic::{AtomicU64, Ordering};

static ID_COUNTER: AtomicU64 = AtomicU64::new(0);

fn next_id() -> String {
    let id = ID_COUNTER.fetch_add(1, Ordering::SeqCst) + 1;
    format!("add-wins-resolution-{}", id)
}

/// Parse a JSON-encoded set (array of strings). Returns None if parsing fails,
/// indicating the content is not a set-like structure.
fn parse_set(data: &[u8]) -> Option<Vec<String>> {
    let s = std::str::from_utf8(data).ok()?;
    let parsed: serde_json::Value = serde_json::from_str(s).ok()?;
    let arr = parsed.as_array()?;
    Some(arr.iter().map(|v| v.as_str().unwrap_or(&v.to_string()).to_string()).collect())
}

pub struct AddWinsResolutionHandlerImpl;

#[async_trait]
impl AddWinsResolutionHandler for AddWinsResolutionHandlerImpl {
    async fn register(
        &self,
        _input: AddWinsResolutionRegisterInput,
        storage: &dyn ConceptStorage,
    ) -> Result<AddWinsResolutionRegisterOutput, Box<dyn std::error::Error>> {
        let id = next_id();

        storage.put("add-wins-resolution", &id, json!({
            "id": id,
            "name": "add-wins",
            "category": "conflict-resolution",
            "priority": 20,
        })).await?;

        Ok(AddWinsResolutionRegisterOutput::Ok {
            name: "add-wins".to_string(),
            category: "conflict-resolution".to_string(),
            priority: 20,
        })
    }

    async fn attempt_resolve(
        &self,
        input: AddWinsResolutionAttemptResolveInput,
        storage: &dyn ConceptStorage,
    ) -> Result<AddWinsResolutionAttemptResolveOutput, Box<dyn std::error::Error>> {
        // Parse both versions as sets
        let set1 = parse_set(&input.v1);
        let set2 = parse_set(&input.v2);

        match (set1, set2) {
            (Some(s1), Some(s2)) => {
                // Add-wins semantics: compute the union of both versions.
                // Items present in either version are kept (additions win over removals).
                let mut union = BTreeSet::new();
                for item in s1 {
                    union.insert(item);
                }
                for item in s2 {
                    union.insert(item);
                }

                let result_vec: Vec<String> = union.into_iter().collect();
                let result_str = serde_json::to_string(&result_vec)?;
                let result_bytes = result_str.into_bytes();

                // Cache the resolution
                let cache_id = next_id();
                let now = chrono::Utc::now().to_rfc3339();
                storage.put("add-wins-resolution", &cache_id, json!({
                    "id": cache_id,
                    "base": input.base,
                    "v1": String::from_utf8_lossy(&input.v1).to_string(),
                    "v2": String::from_utf8_lossy(&input.v2).to_string(),
                    "result": String::from_utf8_lossy(&result_bytes).to_string(),
                    "resolvedAt": now,
                })).await?;

                Ok(AddWinsResolutionAttemptResolveOutput::Resolved {
                    result: result_bytes,
                })
            }
            _ => Ok(AddWinsResolutionAttemptResolveOutput::CannotResolve {
                reason: "Content is not a set-like structure".to_string(),
            }),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_register_returns_ok() {
        let storage = InMemoryStorage::new();
        let handler = AddWinsResolutionHandlerImpl;
        let result = handler.register(
            AddWinsResolutionRegisterInput {},
            &storage,
        ).await.unwrap();
        match result {
            AddWinsResolutionRegisterOutput::Ok { name, category, priority } => {
                assert_eq!(name, "add-wins");
                assert_eq!(category, "conflict-resolution");
                assert_eq!(priority, 20);
            }
        }
    }

    #[tokio::test]
    async fn test_attempt_resolve_union_of_sets() {
        let storage = InMemoryStorage::new();
        let handler = AddWinsResolutionHandlerImpl;
        let v1 = br#"["a","b"]"#.to_vec();
        let v2 = br#"["b","c"]"#.to_vec();
        let result = handler.attempt_resolve(
            AddWinsResolutionAttemptResolveInput {
                base: None,
                v1,
                v2,
                context: "test".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            AddWinsResolutionAttemptResolveOutput::Resolved { result } => {
                let result_str = String::from_utf8(result).unwrap();
                let items: Vec<String> = serde_json::from_str(&result_str).unwrap();
                assert!(items.contains(&"a".to_string()));
                assert!(items.contains(&"b".to_string()));
                assert!(items.contains(&"c".to_string()));
            }
            _ => panic!("Expected Resolved variant"),
        }
    }

    #[tokio::test]
    async fn test_attempt_resolve_non_set_returns_cannot_resolve() {
        let storage = InMemoryStorage::new();
        let handler = AddWinsResolutionHandlerImpl;
        let v1 = b"not-json".to_vec();
        let v2 = b"also-not-json".to_vec();
        let result = handler.attempt_resolve(
            AddWinsResolutionAttemptResolveInput {
                base: None,
                v1,
                v2,
                context: "test".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            AddWinsResolutionAttemptResolveOutput::CannotResolve { reason } => {
                assert!(reason.contains("not a set-like structure"));
            }
            _ => panic!("Expected CannotResolve variant"),
        }
    }
}
