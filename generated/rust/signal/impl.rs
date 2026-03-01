// Signal Handler Implementation
//
// Reactive signals with state, computed, and effect kinds for fine-grained
// reactivity. State signals hold mutable values, computed signals are
// derived (read-only), and effect signals trigger side effects.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::SignalHandler;
use serde_json::json;
use std::sync::atomic::{AtomicU64, Ordering};

static COUNTER: AtomicU64 = AtomicU64::new(0);

fn next_id(prefix: &str) -> String {
    let n = COUNTER.fetch_add(1, Ordering::SeqCst) + 1;
    format!("{}-{}", prefix, n)
}

const VALID_KINDS: &[&str] = &["state", "computed", "effect"];

pub struct SignalHandlerImpl;

#[async_trait]
impl SignalHandler for SignalHandlerImpl {
    async fn create(
        &self,
        input: SignalCreateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SignalCreateOutput, Box<dyn std::error::Error>> {
        if !VALID_KINDS.contains(&input.kind.as_str()) {
            return Ok(SignalCreateOutput::Invalid {
                message: format!(
                    "Invalid signal kind \"{}\". Valid kinds: {}",
                    input.kind,
                    VALID_KINDS.join(", ")
                ),
            });
        }

        let id = if input.signal.is_empty() {
            next_id("G")
        } else {
            input.signal
        };

        storage.put("signal", &id, json!({
            "value": input.initial_value,
            "kind": input.kind,
            "dependencies": "[]",
            "subscribers": "[]",
            "version": 1,
        })).await?;

        Ok(SignalCreateOutput::Ok { signal: id })
    }

    async fn read(
        &self,
        input: SignalReadInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SignalReadOutput, Box<dyn std::error::Error>> {
        let record = storage.get("signal", &input.signal).await?;
        let record = match record {
            Some(r) => r,
            None => {
                return Ok(SignalReadOutput::Notfound {
                    message: format!("Signal \"{}\" not found", input.signal),
                });
            }
        };

        let value = record["value"].as_str().unwrap_or("").to_string();
        let version = record["version"].as_i64().unwrap_or(0);

        Ok(SignalReadOutput::Ok {
            signal: input.signal,
            value,
            version,
        })
    }

    async fn write(
        &self,
        input: SignalWriteInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SignalWriteOutput, Box<dyn std::error::Error>> {
        let record = storage.get("signal", &input.signal).await?;
        let record = match record {
            Some(r) => r,
            None => {
                return Ok(SignalWriteOutput::Notfound {
                    message: format!("Signal \"{}\" not found", input.signal),
                });
            }
        };

        let kind = record["kind"].as_str().unwrap_or("");
        if kind == "computed" {
            return Ok(SignalWriteOutput::Readonly {
                message: "Cannot write to a computed signal".to_string(),
            });
        }
        if kind == "effect" {
            return Ok(SignalWriteOutput::Readonly {
                message: "Cannot write to an effect signal".to_string(),
            });
        }

        let new_version = record["version"].as_i64().unwrap_or(0) + 1;

        let mut updated = record.clone();
        updated["value"] = json!(input.value);
        updated["version"] = json!(new_version);
        storage.put("signal", &input.signal, updated).await?;

        Ok(SignalWriteOutput::Ok {
            signal: input.signal,
            version: new_version,
        })
    }

    async fn batch(
        &self,
        input: SignalBatchInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SignalBatchOutput, Box<dyn std::error::Error>> {
        #[derive(serde::Deserialize)]
        struct BatchUpdate {
            signal: String,
            value: String,
        }

        let updates: Vec<BatchUpdate> = match serde_json::from_str(&input.signals) {
            Ok(v) => v,
            Err(_) => {
                return Ok(SignalBatchOutput::Partial {
                    message: "Invalid signals batch format".to_string(),
                    succeeded: 0,
                    failed: 0,
                });
            }
        };

        let mut success_count: i64 = 0;
        let mut fail_count: i64 = 0;

        for update in &updates {
            let record = storage.get("signal", &update.signal).await?;
            let record = match record {
                Some(r) => r,
                None => {
                    fail_count += 1;
                    continue;
                }
            };

            let kind = record["kind"].as_str().unwrap_or("");
            if kind != "state" {
                fail_count += 1;
                continue;
            }

            let new_version = record["version"].as_i64().unwrap_or(0) + 1;
            let mut updated = record.clone();
            updated["value"] = json!(update.value);
            updated["version"] = json!(new_version);
            storage.put("signal", &update.signal, updated).await?;
            success_count += 1;
        }

        if fail_count > 0 {
            return Ok(SignalBatchOutput::Partial {
                message: format!("{} signal(s) could not be updated", fail_count),
                succeeded: success_count,
                failed: fail_count,
            });
        }

        Ok(SignalBatchOutput::Ok {
            count: success_count,
        })
    }

    async fn dispose(
        &self,
        input: SignalDisposeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SignalDisposeOutput, Box<dyn std::error::Error>> {
        let record = storage.get("signal", &input.signal).await?;
        let record = match record {
            Some(r) => r,
            None => {
                return Ok(SignalDisposeOutput::Notfound {
                    message: format!("Signal \"{}\" not found", input.signal),
                });
            }
        };

        // Clear value, dependencies, and subscribers; mark as disposed
        let mut updated = record.clone();
        updated["value"] = json!("");
        updated["dependencies"] = json!("[]");
        updated["subscribers"] = json!("[]");
        updated["_disposed"] = json!(true);
        storage.put("signal", &input.signal, updated).await?;

        Ok(SignalDisposeOutput::Ok {
            signal: input.signal,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_create_state_signal() {
        let storage = InMemoryStorage::new();
        let handler = SignalHandlerImpl;
        let result = handler.create(
            SignalCreateInput {
                signal: "s1".to_string(),
                kind: "state".to_string(),
                initial_value: "hello".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            SignalCreateOutput::Ok { signal } => {
                assert_eq!(signal, "s1");
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_create_invalid_kind() {
        let storage = InMemoryStorage::new();
        let handler = SignalHandlerImpl;
        let result = handler.create(
            SignalCreateInput {
                signal: "s1".to_string(),
                kind: "invalid".to_string(),
                initial_value: "".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            SignalCreateOutput::Invalid { .. } => {},
            _ => panic!("Expected Invalid variant"),
        }
    }

    #[tokio::test]
    async fn test_read_not_found() {
        let storage = InMemoryStorage::new();
        let handler = SignalHandlerImpl;
        let result = handler.read(
            SignalReadInput { signal: "missing".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            SignalReadOutput::Notfound { .. } => {},
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_write_not_found() {
        let storage = InMemoryStorage::new();
        let handler = SignalHandlerImpl;
        let result = handler.write(
            SignalWriteInput { signal: "missing".to_string(), value: "v".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            SignalWriteOutput::Notfound { .. } => {},
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_write_readonly_computed() {
        let storage = InMemoryStorage::new();
        let handler = SignalHandlerImpl;
        handler.create(
            SignalCreateInput { signal: "c1".to_string(), kind: "computed".to_string(), initial_value: "".to_string() },
            &storage,
        ).await.unwrap();
        let result = handler.write(
            SignalWriteInput { signal: "c1".to_string(), value: "v".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            SignalWriteOutput::Readonly { .. } => {},
            _ => panic!("Expected Readonly variant"),
        }
    }

    #[tokio::test]
    async fn test_batch_invalid_format() {
        let storage = InMemoryStorage::new();
        let handler = SignalHandlerImpl;
        let result = handler.batch(
            SignalBatchInput { signals: "not-json".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            SignalBatchOutput::Partial { .. } => {},
            _ => panic!("Expected Partial variant"),
        }
    }

    #[tokio::test]
    async fn test_dispose_not_found() {
        let storage = InMemoryStorage::new();
        let handler = SignalHandlerImpl;
        let result = handler.dispose(
            SignalDisposeInput { signal: "missing".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            SignalDisposeOutput::Notfound { .. } => {},
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_read_ok() {
        let storage = InMemoryStorage::new();
        let handler = SignalHandlerImpl;
        handler.create(
            SignalCreateInput {
                signal: "r1".to_string(),
                kind: "state".to_string(),
                initial_value: "hello".to_string(),
            },
            &storage,
        ).await.unwrap();
        let result = handler.read(
            SignalReadInput { signal: "r1".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            SignalReadOutput::Ok { signal, value, version } => {
                assert_eq!(signal, "r1");
                assert_eq!(value, "hello");
                assert_eq!(version, 1);
            },
            other => panic!("Expected Ok variant, got {:?}", other),
        }
    }

    #[tokio::test]
    async fn test_write_ok() {
        let storage = InMemoryStorage::new();
        let handler = SignalHandlerImpl;
        handler.create(
            SignalCreateInput {
                signal: "w1".to_string(),
                kind: "state".to_string(),
                initial_value: "old".to_string(),
            },
            &storage,
        ).await.unwrap();
        let result = handler.write(
            SignalWriteInput { signal: "w1".to_string(), value: "new".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            SignalWriteOutput::Ok { signal, version } => {
                assert_eq!(signal, "w1");
                assert_eq!(version, 2);
            },
            other => panic!("Expected Ok variant, got {:?}", other),
        }
    }

    #[tokio::test]
    async fn test_write_readonly_effect() {
        let storage = InMemoryStorage::new();
        let handler = SignalHandlerImpl;
        handler.create(
            SignalCreateInput {
                signal: "e1".to_string(),
                kind: "effect".to_string(),
                initial_value: "".to_string(),
            },
            &storage,
        ).await.unwrap();
        let result = handler.write(
            SignalWriteInput { signal: "e1".to_string(), value: "v".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            SignalWriteOutput::Readonly { message } => {
                assert!(message.contains("effect"));
            },
            other => panic!("Expected Readonly variant, got {:?}", other),
        }
    }

    #[tokio::test]
    async fn test_batch_ok() {
        let storage = InMemoryStorage::new();
        let handler = SignalHandlerImpl;
        handler.create(
            SignalCreateInput {
                signal: "b1".to_string(),
                kind: "state".to_string(),
                initial_value: "a".to_string(),
            },
            &storage,
        ).await.unwrap();
        handler.create(
            SignalCreateInput {
                signal: "b2".to_string(),
                kind: "state".to_string(),
                initial_value: "b".to_string(),
            },
            &storage,
        ).await.unwrap();
        let result = handler.batch(
            SignalBatchInput {
                signals: r#"[{"signal":"b1","value":"x"},{"signal":"b2","value":"y"}]"#.to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            SignalBatchOutput::Ok { count } => {
                assert_eq!(count, 2);
            },
            other => panic!("Expected Ok variant, got {:?}", other),
        }
    }

    #[tokio::test]
    async fn test_batch_partial_missing_signal() {
        let storage = InMemoryStorage::new();
        let handler = SignalHandlerImpl;
        handler.create(
            SignalCreateInput {
                signal: "bp1".to_string(),
                kind: "state".to_string(),
                initial_value: "a".to_string(),
            },
            &storage,
        ).await.unwrap();
        let result = handler.batch(
            SignalBatchInput {
                signals: r#"[{"signal":"bp1","value":"x"},{"signal":"missing","value":"y"}]"#.to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            SignalBatchOutput::Partial { succeeded, failed, .. } => {
                assert_eq!(succeeded, 1);
                assert_eq!(failed, 1);
            },
            other => panic!("Expected Partial variant, got {:?}", other),
        }
    }

    #[tokio::test]
    async fn test_dispose_ok() {
        let storage = InMemoryStorage::new();
        let handler = SignalHandlerImpl;
        handler.create(
            SignalCreateInput {
                signal: "d1".to_string(),
                kind: "state".to_string(),
                initial_value: "val".to_string(),
            },
            &storage,
        ).await.unwrap();
        let result = handler.dispose(
            SignalDisposeInput { signal: "d1".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            SignalDisposeOutput::Ok { signal } => {
                assert_eq!(signal, "d1");
            },
            other => panic!("Expected Ok variant, got {:?}", other),
        }
    }

    #[tokio::test]
    async fn test_create_auto_generated_id() {
        let storage = InMemoryStorage::new();
        let handler = SignalHandlerImpl;
        let result = handler.create(
            SignalCreateInput {
                signal: "".to_string(),
                kind: "state".to_string(),
                initial_value: "auto".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            SignalCreateOutput::Ok { signal } => {
                assert!(signal.starts_with("G-"));
            },
            other => panic!("Expected Ok variant, got {:?}", other),
        }
    }
}
