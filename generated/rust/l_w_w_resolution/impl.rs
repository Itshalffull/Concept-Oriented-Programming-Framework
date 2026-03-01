// Last-Writer-Wins conflict resolution implementation
// Uses causal timestamps to select the most recent write.
// Default strategy for simple key-value stores and LWW registers.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::LWWResolutionHandler;
use serde_json::json;
use std::sync::atomic::{AtomicU64, Ordering};

pub struct LWWResolutionHandlerImpl;

static ID_COUNTER: AtomicU64 = AtomicU64::new(0);

fn next_id() -> String {
    format!("lww-resolution-{}", ID_COUNTER.fetch_add(1, Ordering::SeqCst) + 1)
}

/// Extract a timestamp from a versioned value.
/// Expects JSON with a `_ts` field (number or ISO string), or a raw ISO string.
fn extract_timestamp(value: &[u8]) -> Option<i64> {
    let s = std::str::from_utf8(value).ok()?;

    // Try JSON with _ts field
    if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(s) {
        if let Some(ts) = parsed.get("_ts") {
            if let Some(n) = ts.as_i64() {
                return Some(n);
            }
            if let Some(s) = ts.as_str() {
                if let Ok(dt) = chrono::DateTime::parse_from_rfc3339(s) {
                    return Some(dt.timestamp_millis());
                }
            }
        }
    }

    // Try raw ISO timestamp
    if let Ok(dt) = chrono::DateTime::parse_from_rfc3339(s) {
        return Some(dt.timestamp_millis());
    }

    None
}

#[async_trait]
impl LWWResolutionHandler for LWWResolutionHandlerImpl {
    async fn register(
        &self,
        _input: LWWResolutionRegisterInput,
        storage: &dyn ConceptStorage,
    ) -> Result<LWWResolutionRegisterOutput, Box<dyn std::error::Error>> {
        let id = next_id();
        storage.put("lww-resolution", &id, json!({
            "id": id,
            "name": "lww",
            "category": "conflict-resolution",
            "priority": 10,
        })).await?;

        Ok(LWWResolutionRegisterOutput::Ok {
            name: "lww".into(),
            category: "conflict-resolution".into(),
            priority: 10,
        })
    }

    async fn attempt_resolve(
        &self,
        input: LWWResolutionAttemptResolveInput,
        storage: &dyn ConceptStorage,
    ) -> Result<LWWResolutionAttemptResolveOutput, Box<dyn std::error::Error>> {
        let ts1 = extract_timestamp(&input.v1);
        let ts2 = extract_timestamp(&input.v2);

        match (ts1, ts2) {
            (Some(t1), Some(t2)) => {
                if t1 == t2 {
                    return Ok(LWWResolutionAttemptResolveOutput::CannotResolve {
                        reason: "Timestamps are identical -- exactly concurrent writes with no ordering".into(),
                    });
                }

                let winner = if t1 > t2 { &input.v1 } else { &input.v2 };

                let cache_id = next_id();
                storage.put("lww-resolution", &cache_id, json!({
                    "id": cache_id,
                    "base": input.base,
                    "v1": input.v1,
                    "v2": input.v2,
                    "result": winner,
                    "resolvedAt": chrono::Utc::now().to_rfc3339(),
                })).await?;

                Ok(LWWResolutionAttemptResolveOutput::Resolved {
                    result: winner.clone(),
                })
            }
            _ => Ok(LWWResolutionAttemptResolveOutput::CannotResolve {
                reason: "Unable to extract causal timestamps from one or both values".into(),
            }),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_register() {
        let storage = InMemoryStorage::new();
        let handler = LWWResolutionHandlerImpl;
        let result = handler.register(
            LWWResolutionRegisterInput {},
            &storage,
        ).await.unwrap();
        match result {
            LWWResolutionRegisterOutput::Ok { name, category, priority } => {
                assert_eq!(name, "lww");
                assert_eq!(category, "conflict-resolution");
                assert_eq!(priority, 10);
            }
        }
    }

    #[tokio::test]
    async fn test_attempt_resolve_v1_wins() {
        let storage = InMemoryStorage::new();
        let handler = LWWResolutionHandlerImpl;
        let v1 = br#"{"_ts":2000,"data":"newer"}"#.to_vec();
        let v2 = br#"{"_ts":1000,"data":"older"}"#.to_vec();
        let result = handler.attempt_resolve(
            LWWResolutionAttemptResolveInput {
                base: None,
                v1: v1.clone(),
                v2,
                context: "test".into(),
            },
            &storage,
        ).await.unwrap();
        match result {
            LWWResolutionAttemptResolveOutput::Resolved { result } => {
                assert_eq!(result, v1);
            }
            _ => panic!("Expected Resolved variant"),
        }
    }

    #[tokio::test]
    async fn test_attempt_resolve_identical_timestamps() {
        let storage = InMemoryStorage::new();
        let handler = LWWResolutionHandlerImpl;
        let v1 = br#"{"_ts":1000,"data":"a"}"#.to_vec();
        let v2 = br#"{"_ts":1000,"data":"b"}"#.to_vec();
        let result = handler.attempt_resolve(
            LWWResolutionAttemptResolveInput {
                base: None, v1, v2, context: "test".into(),
            },
            &storage,
        ).await.unwrap();
        match result {
            LWWResolutionAttemptResolveOutput::CannotResolve { reason } => {
                assert!(reason.contains("identical"));
            }
            _ => panic!("Expected CannotResolve variant"),
        }
    }

    #[tokio::test]
    async fn test_attempt_resolve_no_timestamps() {
        let storage = InMemoryStorage::new();
        let handler = LWWResolutionHandlerImpl;
        let result = handler.attempt_resolve(
            LWWResolutionAttemptResolveInput {
                base: None,
                v1: b"plain text".to_vec(),
                v2: b"other text".to_vec(),
                context: "test".into(),
            },
            &storage,
        ).await.unwrap();
        match result {
            LWWResolutionAttemptResolveOutput::CannotResolve { .. } => {}
            _ => panic!("Expected CannotResolve variant"),
        }
    }
}
