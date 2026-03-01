// WebhookInbox concept implementation
// Receives and correlates inbound events from external systems to waiting
// process instances using correlation keys.
// Status lifecycle: waiting -> received -> acknowledged, or waiting -> expired

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::WebhookInboxHandler;
use serde_json::json;

pub struct WebhookInboxHandlerImpl;

fn generate_hook_id() -> String {
    format!("hook-{}", uuid::Uuid::new_v4())
}

#[async_trait]
impl WebhookInboxHandler for WebhookInboxHandlerImpl {
    async fn register(
        &self,
        input: WebhookInboxRegisterInput,
        storage: &dyn ConceptStorage,
    ) -> Result<WebhookInboxRegisterOutput, Box<dyn std::error::Error>> {
        let hook_id = generate_hook_id();
        let timestamp = chrono::Utc::now().to_rfc3339();

        storage.put("webhook_inbox", &hook_id, json!({
            "hook_id": hook_id,
            "run_ref": input.run_ref,
            "step_ref": input.step_ref,
            "event_type": input.event_type,
            "correlation_key": input.correlation_key,
            "status": "waiting",
            "payload": null,
            "registered_at": timestamp,
            "received_at": null,
        })).await?;

        Ok(WebhookInboxRegisterOutput::Ok {
            hook_id,
            run_ref: input.run_ref,
            status: "waiting".to_string(),
        })
    }

    async fn receive(
        &self,
        input: WebhookInboxReceiveInput,
        storage: &dyn ConceptStorage,
    ) -> Result<WebhookInboxReceiveOutput, Box<dyn std::error::Error>> {
        // Find a waiting hook matching the correlation_key + event_type
        let hooks = storage.find("webhook_inbox", Some(&json!({
            "correlation_key": input.correlation_key,
            "event_type": input.event_type,
        }))).await?;

        let waiting = hooks.iter().find(|h| h["status"].as_str() == Some("waiting"));

        match waiting {
            None => Ok(WebhookInboxReceiveOutput::NoMatch {
                correlation_key: input.correlation_key,
            }),
            Some(record) => {
                let hook_id = record["hook_id"].as_str().unwrap_or("").to_string();
                let run_ref = record["run_ref"].as_str().unwrap_or("").to_string();
                let step_ref = record["step_ref"].as_str().unwrap_or("").to_string();

                let mut updated = record.clone();
                if let Some(obj) = updated.as_object_mut() {
                    obj.insert("status".to_string(), json!("received"));
                    obj.insert("payload".to_string(), json!(input.payload));
                    obj.insert("received_at".to_string(), json!(chrono::Utc::now().to_rfc3339()));
                }

                storage.put("webhook_inbox", &hook_id, updated).await?;

                Ok(WebhookInboxReceiveOutput::Ok {
                    hook_id,
                    run_ref,
                    step_ref,
                    payload: input.payload,
                })
            }
        }
    }

    async fn expire(
        &self,
        input: WebhookInboxExpireInput,
        storage: &dyn ConceptStorage,
    ) -> Result<WebhookInboxExpireOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("webhook_inbox", &input.hook_id).await?;

        match existing {
            None => Ok(WebhookInboxExpireOutput::NotFound {
                hook_id: input.hook_id,
            }),
            Some(record) => {
                let current_status = record["status"].as_str().unwrap_or("unknown").to_string();
                if current_status != "waiting" {
                    return Ok(WebhookInboxExpireOutput::NotWaiting {
                        hook_id: input.hook_id,
                        current_status,
                    });
                }

                let run_ref = record["run_ref"].as_str().unwrap_or("").to_string();
                let step_ref = record["step_ref"].as_str().unwrap_or("").to_string();

                let mut updated = record.clone();
                if let Some(obj) = updated.as_object_mut() {
                    obj.insert("status".to_string(), json!("expired"));
                    obj.insert("expired_at".to_string(), json!(chrono::Utc::now().to_rfc3339()));
                }

                storage.put("webhook_inbox", &input.hook_id, updated).await?;

                Ok(WebhookInboxExpireOutput::Ok {
                    hook_id: input.hook_id,
                    run_ref,
                    step_ref,
                })
            }
        }
    }

    async fn ack(
        &self,
        input: WebhookInboxAckInput,
        storage: &dyn ConceptStorage,
    ) -> Result<WebhookInboxAckOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("webhook_inbox", &input.hook_id).await?;

        match existing {
            None => Ok(WebhookInboxAckOutput::NotFound {
                hook_id: input.hook_id,
            }),
            Some(record) => {
                let current_status = record["status"].as_str().unwrap_or("unknown").to_string();
                if current_status != "received" {
                    return Ok(WebhookInboxAckOutput::NotReceived {
                        hook_id: input.hook_id,
                        current_status,
                    });
                }

                let mut updated = record.clone();
                if let Some(obj) = updated.as_object_mut() {
                    obj.insert("status".to_string(), json!("acknowledged"));
                    obj.insert("acknowledged_at".to_string(), json!(chrono::Utc::now().to_rfc3339()));
                }

                storage.put("webhook_inbox", &input.hook_id, updated).await?;

                Ok(WebhookInboxAckOutput::Ok {
                    hook_id: input.hook_id,
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
    async fn test_register_creates_waiting_hook() {
        let storage = InMemoryStorage::new();
        let handler = WebhookInboxHandlerImpl;
        let result = handler.register(
            WebhookInboxRegisterInput {
                run_ref: "run-001".to_string(),
                step_ref: "wait-payment".to_string(),
                event_type: "payment.completed".to_string(),
                correlation_key: "order-123".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            WebhookInboxRegisterOutput::Ok { hook_id, run_ref, status } => {
                assert!(hook_id.starts_with("hook-"));
                assert_eq!(run_ref, "run-001");
                assert_eq!(status, "waiting");
            }
        }
    }

    #[tokio::test]
    async fn test_receive_matches_waiting_hook() {
        let storage = InMemoryStorage::new();
        let handler = WebhookInboxHandlerImpl;

        handler.register(
            WebhookInboxRegisterInput {
                run_ref: "run-002".to_string(),
                step_ref: "wait-callback".to_string(),
                event_type: "callback.received".to_string(),
                correlation_key: "txn-456".to_string(),
            },
            &storage,
        ).await.unwrap();

        let result = handler.receive(
            WebhookInboxReceiveInput {
                correlation_key: "txn-456".to_string(),
                event_type: "callback.received".to_string(),
                payload: json!({ "status": "success" }),
            },
            &storage,
        ).await.unwrap();
        match result {
            WebhookInboxReceiveOutput::Ok { run_ref, step_ref, payload, .. } => {
                assert_eq!(run_ref, "run-002");
                assert_eq!(step_ref, "wait-callback");
                assert_eq!(payload["status"], "success");
            }
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_receive_no_match() {
        let storage = InMemoryStorage::new();
        let handler = WebhookInboxHandlerImpl;

        let result = handler.receive(
            WebhookInboxReceiveInput {
                correlation_key: "unknown-key".to_string(),
                event_type: "some.event".to_string(),
                payload: json!({}),
            },
            &storage,
        ).await.unwrap();
        match result {
            WebhookInboxReceiveOutput::NoMatch { correlation_key } => {
                assert_eq!(correlation_key, "unknown-key");
            }
            _ => panic!("Expected NoMatch variant"),
        }
    }

    #[tokio::test]
    async fn test_expire_waiting_hook() {
        let storage = InMemoryStorage::new();
        let handler = WebhookInboxHandlerImpl;

        let reg = handler.register(
            WebhookInboxRegisterInput {
                run_ref: "run-003".to_string(),
                step_ref: "wait-event".to_string(),
                event_type: "event.x".to_string(),
                correlation_key: "key-789".to_string(),
            },
            &storage,
        ).await.unwrap();
        let hook_id = match reg {
            WebhookInboxRegisterOutput::Ok { hook_id, .. } => hook_id,
        };

        let result = handler.expire(
            WebhookInboxExpireInput { hook_id: hook_id.clone() },
            &storage,
        ).await.unwrap();
        match result {
            WebhookInboxExpireOutput::Ok { run_ref, step_ref, .. } => {
                assert_eq!(run_ref, "run-003");
                assert_eq!(step_ref, "wait-event");
            }
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_ack_received_hook() {
        let storage = InMemoryStorage::new();
        let handler = WebhookInboxHandlerImpl;

        let reg = handler.register(
            WebhookInboxRegisterInput {
                run_ref: "run-004".to_string(),
                step_ref: "wait-ack".to_string(),
                event_type: "ack.event".to_string(),
                correlation_key: "ack-key".to_string(),
            },
            &storage,
        ).await.unwrap();
        let hook_id = match reg {
            WebhookInboxRegisterOutput::Ok { hook_id, .. } => hook_id,
        };

        handler.receive(
            WebhookInboxReceiveInput {
                correlation_key: "ack-key".to_string(),
                event_type: "ack.event".to_string(),
                payload: json!({ "data": 1 }),
            },
            &storage,
        ).await.unwrap();

        let result = handler.ack(
            WebhookInboxAckInput { hook_id: hook_id.clone() },
            &storage,
        ).await.unwrap();
        match result {
            WebhookInboxAckOutput::Ok { .. } => {}
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_ack_waiting_returns_not_received() {
        let storage = InMemoryStorage::new();
        let handler = WebhookInboxHandlerImpl;

        let reg = handler.register(
            WebhookInboxRegisterInput {
                run_ref: "run-005".to_string(),
                step_ref: "step-x".to_string(),
                event_type: "ev".to_string(),
                correlation_key: "k".to_string(),
            },
            &storage,
        ).await.unwrap();
        let hook_id = match reg {
            WebhookInboxRegisterOutput::Ok { hook_id, .. } => hook_id,
        };

        let result = handler.ack(
            WebhookInboxAckInput { hook_id: hook_id.clone() },
            &storage,
        ).await.unwrap();
        match result {
            WebhookInboxAckOutput::NotReceived { current_status, .. } => {
                assert_eq!(current_status, "waiting");
            }
            _ => panic!("Expected NotReceived variant"),
        }
    }
}
