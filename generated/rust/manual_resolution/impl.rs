// Manual conflict resolution implementation
// Escalates to human reviewer. Returns CannotResolve variant
// and stores the conflict for manual review. Used as last-resort
// policy when no automatic strategy can make a domain-safe decision.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::ManualResolutionHandler;
use serde_json::json;
use std::sync::atomic::{AtomicU64, Ordering};

pub struct ManualResolutionHandlerImpl;

static ID_COUNTER: AtomicU64 = AtomicU64::new(0);

fn next_id() -> String {
    format!("manual-resolution-{}", ID_COUNTER.fetch_add(1, Ordering::SeqCst) + 1)
}

#[async_trait]
impl ManualResolutionHandler for ManualResolutionHandlerImpl {
    async fn register(
        &self,
        _input: ManualResolutionRegisterInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ManualResolutionRegisterOutput, Box<dyn std::error::Error>> {
        let id = next_id();
        storage.put("manual-resolution", &id, json!({
            "id": id,
            "name": "manual",
            "category": "conflict-resolution",
            "priority": 99,
        })).await?;

        Ok(ManualResolutionRegisterOutput::Ok {
            name: "manual".into(),
            category: "conflict-resolution".into(),
            priority: 99,
        })
    }

    async fn attempt_resolve(
        &self,
        input: ManualResolutionAttemptResolveInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ManualResolutionAttemptResolveOutput, Box<dyn std::error::Error>> {
        // Manual resolution never auto-resolves. Store conflict for human review.
        let conflict_id = next_id();
        let mut candidates = vec![
            serde_json::to_value(&input.v1)?,
            serde_json::to_value(&input.v2)?,
        ];
        if let Some(ref base) = input.base {
            candidates.push(serde_json::to_value(base)?);
        }

        storage.put("manual-resolution", &conflict_id, json!({
            "id": conflict_id,
            "base": input.base,
            "v1": input.v1,
            "v2": input.v2,
            "context": input.context,
            "candidates": serde_json::to_string(&candidates)?,
            "status": "pending",
            "createdAt": chrono::Utc::now().to_rfc3339(),
        })).await?;

        Ok(ManualResolutionAttemptResolveOutput::CannotResolve {
            reason: "Manual resolution required -- escalating to human review".into(),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_register() {
        let storage = InMemoryStorage::new();
        let handler = ManualResolutionHandlerImpl;
        let result = handler.register(
            ManualResolutionRegisterInput {},
            &storage,
        ).await.unwrap();
        match result {
            ManualResolutionRegisterOutput::Ok { name, category, priority } => {
                assert_eq!(name, "manual");
                assert_eq!(category, "conflict-resolution");
                assert_eq!(priority, 99);
            }
        }
    }

    #[tokio::test]
    async fn test_attempt_resolve_always_cannot_resolve() {
        let storage = InMemoryStorage::new();
        let handler = ManualResolutionHandlerImpl;
        let result = handler.attempt_resolve(
            ManualResolutionAttemptResolveInput {
                base: Some(b"base".to_vec()),
                v1: b"version1".to_vec(),
                v2: b"version2".to_vec(),
                context: "test".into(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ManualResolutionAttemptResolveOutput::CannotResolve { reason } => {
                assert!(reason.contains("Manual resolution required"));
            }
        }
    }

    #[tokio::test]
    async fn test_attempt_resolve_without_base() {
        let storage = InMemoryStorage::new();
        let handler = ManualResolutionHandlerImpl;
        let result = handler.attempt_resolve(
            ManualResolutionAttemptResolveInput {
                base: None,
                v1: b"a".to_vec(),
                v2: b"b".to_vec(),
                context: "ctx".into(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ManualResolutionAttemptResolveOutput::CannotResolve { .. } => {}
        }
    }
}
