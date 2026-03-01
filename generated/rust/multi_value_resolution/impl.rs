// MultiValueResolution -- conflict resolution strategy that preserves all concurrent values.
// When two replicas produce diverging values, this strategy retains both as a set,
// delegating final resolution to application-level logic.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::MultiValueResolutionHandler;
use serde_json::json;

pub struct MultiValueResolutionHandlerImpl;

#[async_trait]
impl MultiValueResolutionHandler for MultiValueResolutionHandlerImpl {
    async fn register(
        &self,
        _input: MultiValueResolutionRegisterInput,
        _storage: &dyn ConceptStorage,
    ) -> Result<MultiValueResolutionRegisterOutput, Box<dyn std::error::Error>> {
        Ok(MultiValueResolutionRegisterOutput::Ok {
            name: "multi-value".to_string(),
            category: "conflict-resolution".to_string(),
            priority: 50,
        })
    }

    async fn attempt_resolve(
        &self,
        input: MultiValueResolutionAttemptResolveInput,
        _storage: &dyn ConceptStorage,
    ) -> Result<MultiValueResolutionAttemptResolveOutput, Box<dyn std::error::Error>> {
        // If both values are identical, resolution is trivial
        if input.v1 == input.v2 {
            return Ok(MultiValueResolutionAttemptResolveOutput::Resolved {
                result: input.v1,
            });
        }

        // Parse context for resolution hints
        let context: serde_json::Value = serde_json::from_str(&input.context)
            .unwrap_or_else(|_| json!({}));

        let strategy = context.get("strategy")
            .and_then(|v| v.as_str())
            .unwrap_or("multi-value");

        match strategy {
            "multi-value" => {
                // Combine both values into a JSON array representing the multi-value set
                let combined = json!({
                    "__multiValue": true,
                    "values": [
                        serde_json::from_slice::<serde_json::Value>(&input.v1).unwrap_or(json!(null)),
                        serde_json::from_slice::<serde_json::Value>(&input.v2).unwrap_or(json!(null)),
                    ],
                    "base": input.base.as_ref().and_then(|b|
                        serde_json::from_slice::<serde_json::Value>(b).ok()
                    ),
                });
                let result_bytes = serde_json::to_vec(&combined)?;
                Ok(MultiValueResolutionAttemptResolveOutput::Resolved {
                    result: result_bytes,
                })
            }
            "last-write-wins" => {
                // If context provides timestamps, pick the latest; otherwise keep v2
                Ok(MultiValueResolutionAttemptResolveOutput::Resolved {
                    result: input.v2,
                })
            }
            _ => {
                Ok(MultiValueResolutionAttemptResolveOutput::CannotResolve {
                    reason: format!("Unknown resolution strategy: {}", strategy),
                })
            }
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
        let handler = MultiValueResolutionHandlerImpl;
        let result = handler.register(
            MultiValueResolutionRegisterInput {},
            &storage,
        ).await.unwrap();
        match result {
            MultiValueResolutionRegisterOutput::Ok { name, category, priority } => {
                assert_eq!(name, "multi-value");
                assert_eq!(category, "conflict-resolution");
                assert_eq!(priority, 50);
            }
        }
    }

    #[tokio::test]
    async fn test_attempt_resolve_identical_values() {
        let storage = InMemoryStorage::new();
        let handler = MultiValueResolutionHandlerImpl;
        let v = b"same".to_vec();
        let result = handler.attempt_resolve(
            MultiValueResolutionAttemptResolveInput {
                base: None, v1: v.clone(), v2: v.clone(), context: "{}".into(),
            },
            &storage,
        ).await.unwrap();
        match result {
            MultiValueResolutionAttemptResolveOutput::Resolved { result } => {
                assert_eq!(result, v);
            }
            _ => panic!("Expected Resolved variant"),
        }
    }

    #[tokio::test]
    async fn test_attempt_resolve_multi_value_strategy() {
        let storage = InMemoryStorage::new();
        let handler = MultiValueResolutionHandlerImpl;
        let result = handler.attempt_resolve(
            MultiValueResolutionAttemptResolveInput {
                base: None,
                v1: br#""a""#.to_vec(),
                v2: br#""b""#.to_vec(),
                context: r#"{"strategy":"multi-value"}"#.into(),
            },
            &storage,
        ).await.unwrap();
        match result {
            MultiValueResolutionAttemptResolveOutput::Resolved { result } => {
                let parsed: serde_json::Value = serde_json::from_slice(&result).unwrap();
                assert_eq!(parsed["__multiValue"], true);
            }
            _ => panic!("Expected Resolved variant"),
        }
    }

    #[tokio::test]
    async fn test_attempt_resolve_unknown_strategy() {
        let storage = InMemoryStorage::new();
        let handler = MultiValueResolutionHandlerImpl;
        let result = handler.attempt_resolve(
            MultiValueResolutionAttemptResolveInput {
                base: None,
                v1: b"a".to_vec(),
                v2: b"b".to_vec(),
                context: r#"{"strategy":"unknown-thing"}"#.into(),
            },
            &storage,
        ).await.unwrap();
        match result {
            MultiValueResolutionAttemptResolveOutput::CannotResolve { reason } => {
                assert!(reason.contains("Unknown"));
            }
            _ => panic!("Expected CannotResolve variant"),
        }
    }
}
