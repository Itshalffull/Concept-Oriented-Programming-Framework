// FlowToken concept implementation
// Token-based flow control for process execution graphs.
// Tokens are emitted at nodes, consumed when traversing edges,
// and killed to cancel pending work. Active token count drives
// process completion detection.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::FlowTokenHandler;
use serde_json::json;

pub struct FlowTokenHandlerImpl;

fn generate_token_id() -> String {
    format!("tok-{}", uuid::Uuid::new_v4())
}

fn token_key(run_ref: &str, token_id: &str) -> String {
    format!("{}::{}", run_ref, token_id)
}

#[async_trait]
impl FlowTokenHandler for FlowTokenHandlerImpl {
    async fn emit(
        &self,
        input: FlowTokenEmitInput,
        storage: &dyn ConceptStorage,
    ) -> Result<FlowTokenEmitOutput, Box<dyn std::error::Error>> {
        let token_id = generate_token_id();
        let key = token_key(&input.run_ref, &token_id);
        let timestamp = chrono::Utc::now().to_rfc3339();

        storage.put("flow_tokens", &key, json!({
            "token_id": token_id,
            "run_ref": input.run_ref,
            "node_ref": input.node_ref,
            "token_type": input.token_type.clone().unwrap_or_else(|| "default".to_string()),
            "payload": input.payload,
            "status": "active",
            "emitted_at": timestamp,
        })).await?;

        Ok(FlowTokenEmitOutput::Ok {
            token_id,
            run_ref: input.run_ref,
            node_ref: input.node_ref,
        })
    }

    async fn consume(
        &self,
        input: FlowTokenConsumeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<FlowTokenConsumeOutput, Box<dyn std::error::Error>> {
        let key = token_key(&input.run_ref, &input.token_id);
        let existing = storage.get("flow_tokens", &key).await?;

        match existing {
            None => Ok(FlowTokenConsumeOutput::NotFound {
                token_id: input.token_id,
            }),
            Some(record) => {
                let status = record["status"].as_str().unwrap_or("unknown");
                if status != "active" {
                    return Ok(FlowTokenConsumeOutput::AlreadyConsumed {
                        token_id: input.token_id,
                    });
                }

                let mut updated = record.clone();
                if let Some(obj) = updated.as_object_mut() {
                    obj.insert("status".to_string(), json!("consumed"));
                    obj.insert("consumed_at".to_string(), json!(chrono::Utc::now().to_rfc3339()));
                }

                storage.put("flow_tokens", &key, updated).await?;

                Ok(FlowTokenConsumeOutput::Ok {
                    token_id: input.token_id,
                })
            }
        }
    }

    async fn kill(
        &self,
        input: FlowTokenKillInput,
        storage: &dyn ConceptStorage,
    ) -> Result<FlowTokenKillOutput, Box<dyn std::error::Error>> {
        let key = token_key(&input.run_ref, &input.token_id);
        let existing = storage.get("flow_tokens", &key).await?;

        match existing {
            None => Ok(FlowTokenKillOutput::NotFound {
                token_id: input.token_id,
            }),
            Some(record) => {
                let status = record["status"].as_str().unwrap_or("unknown").to_string();
                if status != "active" {
                    return Ok(FlowTokenKillOutput::AlreadyInactive {
                        token_id: input.token_id,
                        status,
                    });
                }

                let mut updated = record.clone();
                if let Some(obj) = updated.as_object_mut() {
                    obj.insert("status".to_string(), json!("killed"));
                    obj.insert("killed_at".to_string(), json!(chrono::Utc::now().to_rfc3339()));
                    if let Some(reason) = &input.reason {
                        obj.insert("kill_reason".to_string(), json!(reason));
                    }
                }

                storage.put("flow_tokens", &key, updated).await?;

                Ok(FlowTokenKillOutput::Ok {
                    token_id: input.token_id,
                })
            }
        }
    }

    async fn count_active(
        &self,
        input: FlowTokenCountActiveInput,
        storage: &dyn ConceptStorage,
    ) -> Result<FlowTokenCountActiveOutput, Box<dyn std::error::Error>> {
        let all_tokens = storage.find("flow_tokens", Some(&json!({
            "run_ref": input.run_ref,
        }))).await?;

        let count = all_tokens
            .iter()
            .filter(|t| t["status"].as_str() == Some("active"))
            .count() as i64;

        Ok(FlowTokenCountActiveOutput::Ok { count })
    }

    async fn list_active(
        &self,
        input: FlowTokenListActiveInput,
        storage: &dyn ConceptStorage,
    ) -> Result<FlowTokenListActiveOutput, Box<dyn std::error::Error>> {
        let all_tokens = storage.find("flow_tokens", Some(&json!({
            "run_ref": input.run_ref,
        }))).await?;

        let active: Vec<serde_json::Value> = all_tokens
            .into_iter()
            .filter(|t| t["status"].as_str() == Some("active"))
            .collect();

        Ok(FlowTokenListActiveOutput::Ok { tokens: active })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_emit_creates_active_token() {
        let storage = InMemoryStorage::new();
        let handler = FlowTokenHandlerImpl;
        let result = handler.emit(
            FlowTokenEmitInput {
                run_ref: "run-001".to_string(),
                node_ref: "start-node".to_string(),
                token_type: None,
                payload: None,
            },
            &storage,
        ).await.unwrap();
        match result {
            FlowTokenEmitOutput::Ok { token_id, run_ref, node_ref } => {
                assert!(token_id.starts_with("tok-"));
                assert_eq!(run_ref, "run-001");
                assert_eq!(node_ref, "start-node");
            }
        }
    }

    #[tokio::test]
    async fn test_consume_active_token() {
        let storage = InMemoryStorage::new();
        let handler = FlowTokenHandlerImpl;

        let emit_result = handler.emit(
            FlowTokenEmitInput {
                run_ref: "run-002".to_string(),
                node_ref: "node-a".to_string(),
                token_type: None,
                payload: None,
            },
            &storage,
        ).await.unwrap();

        let token_id = match emit_result {
            FlowTokenEmitOutput::Ok { token_id, .. } => token_id,
        };

        let result = handler.consume(
            FlowTokenConsumeInput {
                token_id: token_id.clone(),
                run_ref: "run-002".to_string(),
            },
            &storage,
        ).await.unwrap();

        match result {
            FlowTokenConsumeOutput::Ok { token_id: tid } => {
                assert_eq!(tid, token_id);
            }
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_consume_already_consumed_token() {
        let storage = InMemoryStorage::new();
        let handler = FlowTokenHandlerImpl;

        let emit_result = handler.emit(
            FlowTokenEmitInput {
                run_ref: "run-003".to_string(),
                node_ref: "node-b".to_string(),
                token_type: None,
                payload: None,
            },
            &storage,
        ).await.unwrap();

        let token_id = match emit_result {
            FlowTokenEmitOutput::Ok { token_id, .. } => token_id,
        };

        handler.consume(
            FlowTokenConsumeInput {
                token_id: token_id.clone(),
                run_ref: "run-003".to_string(),
            },
            &storage,
        ).await.unwrap();

        let result = handler.consume(
            FlowTokenConsumeInput {
                token_id: token_id.clone(),
                run_ref: "run-003".to_string(),
            },
            &storage,
        ).await.unwrap();

        match result {
            FlowTokenConsumeOutput::AlreadyConsumed { .. } => {}
            _ => panic!("Expected AlreadyConsumed variant"),
        }
    }

    #[tokio::test]
    async fn test_consume_nonexistent_returns_not_found() {
        let storage = InMemoryStorage::new();
        let handler = FlowTokenHandlerImpl;

        let result = handler.consume(
            FlowTokenConsumeInput {
                token_id: "tok-nonexistent".to_string(),
                run_ref: "run-004".to_string(),
            },
            &storage,
        ).await.unwrap();

        match result {
            FlowTokenConsumeOutput::NotFound { .. } => {}
            _ => panic!("Expected NotFound variant"),
        }
    }

    #[tokio::test]
    async fn test_kill_active_token() {
        let storage = InMemoryStorage::new();
        let handler = FlowTokenHandlerImpl;

        let emit_result = handler.emit(
            FlowTokenEmitInput {
                run_ref: "run-005".to_string(),
                node_ref: "node-c".to_string(),
                token_type: None,
                payload: None,
            },
            &storage,
        ).await.unwrap();

        let token_id = match emit_result {
            FlowTokenEmitOutput::Ok { token_id, .. } => token_id,
        };

        let result = handler.kill(
            FlowTokenKillInput {
                token_id: token_id.clone(),
                run_ref: "run-005".to_string(),
                reason: Some("cancelled by user".to_string()),
            },
            &storage,
        ).await.unwrap();

        match result {
            FlowTokenKillOutput::Ok { token_id: tid } => {
                assert_eq!(tid, token_id);
            }
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_kill_already_consumed_returns_already_inactive() {
        let storage = InMemoryStorage::new();
        let handler = FlowTokenHandlerImpl;

        let emit_result = handler.emit(
            FlowTokenEmitInput {
                run_ref: "run-006".to_string(),
                node_ref: "node-d".to_string(),
                token_type: None,
                payload: None,
            },
            &storage,
        ).await.unwrap();

        let token_id = match emit_result {
            FlowTokenEmitOutput::Ok { token_id, .. } => token_id,
        };

        handler.consume(
            FlowTokenConsumeInput {
                token_id: token_id.clone(),
                run_ref: "run-006".to_string(),
            },
            &storage,
        ).await.unwrap();

        let result = handler.kill(
            FlowTokenKillInput {
                token_id: token_id.clone(),
                run_ref: "run-006".to_string(),
                reason: None,
            },
            &storage,
        ).await.unwrap();

        match result {
            FlowTokenKillOutput::AlreadyInactive { status, .. } => {
                assert_eq!(status, "consumed");
            }
            _ => panic!("Expected AlreadyInactive variant"),
        }
    }

    #[tokio::test]
    async fn test_count_active_tokens() {
        let storage = InMemoryStorage::new();
        let handler = FlowTokenHandlerImpl;

        // Emit 3 tokens
        let mut token_ids = Vec::new();
        for i in 0..3 {
            let result = handler.emit(
                FlowTokenEmitInput {
                    run_ref: "run-007".to_string(),
                    node_ref: format!("node-{}", i),
                    token_type: None,
                    payload: None,
                },
                &storage,
            ).await.unwrap();
            match result {
                FlowTokenEmitOutput::Ok { token_id, .. } => token_ids.push(token_id),
            }
        }

        // Consume one
        handler.consume(
            FlowTokenConsumeInput {
                token_id: token_ids[0].clone(),
                run_ref: "run-007".to_string(),
            },
            &storage,
        ).await.unwrap();

        let result = handler.count_active(
            FlowTokenCountActiveInput {
                run_ref: "run-007".to_string(),
            },
            &storage,
        ).await.unwrap();

        match result {
            FlowTokenCountActiveOutput::Ok { count } => {
                assert_eq!(count, 2);
            }
        }
    }

    #[tokio::test]
    async fn test_list_active_tokens() {
        let storage = InMemoryStorage::new();
        let handler = FlowTokenHandlerImpl;

        handler.emit(
            FlowTokenEmitInput {
                run_ref: "run-008".to_string(),
                node_ref: "node-x".to_string(),
                token_type: Some("signal".to_string()),
                payload: Some(json!({ "data": 1 })),
            },
            &storage,
        ).await.unwrap();

        handler.emit(
            FlowTokenEmitInput {
                run_ref: "run-008".to_string(),
                node_ref: "node-y".to_string(),
                token_type: None,
                payload: None,
            },
            &storage,
        ).await.unwrap();

        let result = handler.list_active(
            FlowTokenListActiveInput {
                run_ref: "run-008".to_string(),
            },
            &storage,
        ).await.unwrap();

        match result {
            FlowTokenListActiveOutput::Ok { tokens } => {
                assert_eq!(tokens.len(), 2);
                for t in &tokens {
                    assert_eq!(t["status"].as_str().unwrap(), "active");
                }
            }
        }
    }
}
