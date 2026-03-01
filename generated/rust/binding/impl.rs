// Binding concept implementation
// Surface core binding between concepts and UI surfaces with mode-aware synchronization.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::BindingHandler;
use serde_json::json;
use std::sync::atomic::{AtomicU64, Ordering};

static COUNTER: AtomicU64 = AtomicU64::new(0);

fn next_id(prefix: &str) -> String {
    let id = COUNTER.fetch_add(1, Ordering::SeqCst) + 1;
    format!("{}-{}", prefix, id)
}

const VALID_MODES: &[&str] = &["coupled", "rest", "graphql", "static"];

pub struct BindingHandlerImpl;

#[async_trait]
impl BindingHandler for BindingHandlerImpl {
    async fn bind(
        &self,
        input: BindingBindInput,
        storage: &dyn ConceptStorage,
    ) -> Result<BindingBindOutput, Box<dyn std::error::Error>> {
        if !VALID_MODES.contains(&input.mode.as_str()) {
            return Ok(BindingBindOutput::Invalid {
                message: format!(
                    "Invalid mode \"{}\". Valid modes: {}",
                    input.mode,
                    VALID_MODES.join(", ")
                ),
            });
        }

        let id = if input.binding.is_empty() {
            next_id("B")
        } else {
            input.binding
        };

        storage.put("binding", &id, json!({
            "concept": input.concept,
            "mode": input.mode,
            "endpoint": "",
            "lastSync": "",
            "status": "bound",
            "signalMap": "{}",
        })).await?;

        Ok(BindingBindOutput::Ok { binding: id })
    }

    async fn sync(
        &self,
        input: BindingSyncInput,
        storage: &dyn ConceptStorage,
    ) -> Result<BindingSyncOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("binding", &input.binding).await?;
        let existing = match existing {
            Some(r) => r,
            None => return Ok(BindingSyncOutput::Error {
                message: "Binding not found".to_string(),
            }),
        };

        let now = chrono::Utc::now().to_rfc3339();

        let mut updated = existing.clone();
        updated["lastSync"] = json!(now);
        updated["status"] = json!("synced");
        storage.put("binding", &input.binding, updated).await?;

        Ok(BindingSyncOutput::Ok {
            binding: input.binding,
        })
    }

    async fn invoke(
        &self,
        input: BindingInvokeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<BindingInvokeOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("binding", &input.binding).await?;
        let existing = match existing {
            Some(r) => r,
            None => return Ok(BindingInvokeOutput::Error {
                message: "Binding not found".to_string(),
            }),
        };

        if existing["status"].as_str() == Some("unbound") {
            return Ok(BindingInvokeOutput::Error {
                message: "Binding is not active".to_string(),
            });
        }

        let concept = existing["concept"].as_str().unwrap_or("");
        let result = format!("{}:{}({})", concept, input.action, input.input);

        Ok(BindingInvokeOutput::Ok {
            binding: input.binding,
            result,
        })
    }

    async fn unbind(
        &self,
        input: BindingUnbindInput,
        storage: &dyn ConceptStorage,
    ) -> Result<BindingUnbindOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("binding", &input.binding).await?;
        let existing = match existing {
            Some(r) => r,
            None => return Ok(BindingUnbindOutput::Notfound {
                message: "Binding not found".to_string(),
            }),
        };

        let mut updated = existing.clone();
        updated["status"] = json!("unbound");
        updated["lastSync"] = json!("");
        storage.put("binding", &input.binding, updated).await?;

        Ok(BindingUnbindOutput::Ok {
            binding: input.binding,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_bind_success() {
        let storage = InMemoryStorage::new();
        let handler = BindingHandlerImpl;
        let result = handler.bind(
            BindingBindInput {
                binding: "b-1".to_string(),
                concept: "article".to_string(),
                mode: "coupled".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            BindingBindOutput::Ok { binding } => {
                assert_eq!(binding, "b-1");
            }
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_bind_invalid_mode() {
        let storage = InMemoryStorage::new();
        let handler = BindingHandlerImpl;
        let result = handler.bind(
            BindingBindInput {
                binding: "b-2".to_string(),
                concept: "article".to_string(),
                mode: "invalid-mode".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            BindingBindOutput::Invalid { message } => {
                assert!(message.contains("Invalid mode"));
            }
            _ => panic!("Expected Invalid variant"),
        }
    }

    #[tokio::test]
    async fn test_sync_success() {
        let storage = InMemoryStorage::new();
        let handler = BindingHandlerImpl;
        handler.bind(
            BindingBindInput {
                binding: "b-3".to_string(),
                concept: "user".to_string(),
                mode: "rest".to_string(),
            },
            &storage,
        ).await.unwrap();
        let result = handler.sync(
            BindingSyncInput { binding: "b-3".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            BindingSyncOutput::Ok { binding } => {
                assert_eq!(binding, "b-3");
            }
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_sync_not_found() {
        let storage = InMemoryStorage::new();
        let handler = BindingHandlerImpl;
        let result = handler.sync(
            BindingSyncInput { binding: "missing".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            BindingSyncOutput::Error { .. } => {}
            _ => panic!("Expected Error variant"),
        }
    }

    #[tokio::test]
    async fn test_invoke_success() {
        let storage = InMemoryStorage::new();
        let handler = BindingHandlerImpl;
        handler.bind(
            BindingBindInput {
                binding: "b-4".to_string(),
                concept: "article".to_string(),
                mode: "graphql".to_string(),
            },
            &storage,
        ).await.unwrap();
        let result = handler.invoke(
            BindingInvokeInput {
                binding: "b-4".to_string(),
                action: "create".to_string(),
                input: "data".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            BindingInvokeOutput::Ok { result, .. } => {
                assert!(result.contains("article:create(data)"));
            }
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_invoke_not_found() {
        let storage = InMemoryStorage::new();
        let handler = BindingHandlerImpl;
        let result = handler.invoke(
            BindingInvokeInput {
                binding: "missing".to_string(),
                action: "x".to_string(),
                input: "y".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            BindingInvokeOutput::Error { .. } => {}
            _ => panic!("Expected Error variant"),
        }
    }

    #[tokio::test]
    async fn test_unbind_success() {
        let storage = InMemoryStorage::new();
        let handler = BindingHandlerImpl;
        handler.bind(
            BindingBindInput {
                binding: "b-5".to_string(),
                concept: "profile".to_string(),
                mode: "static".to_string(),
            },
            &storage,
        ).await.unwrap();
        let result = handler.unbind(
            BindingUnbindInput { binding: "b-5".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            BindingUnbindOutput::Ok { binding } => {
                assert_eq!(binding, "b-5");
            }
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_unbind_notfound() {
        let storage = InMemoryStorage::new();
        let handler = BindingHandlerImpl;
        let result = handler.unbind(
            BindingUnbindInput { binding: "missing".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            BindingUnbindOutput::Notfound { .. } => {}
            _ => panic!("Expected Notfound variant"),
        }
    }
}
