// ConnectorCall concept implementation
// Manages external connector invocations with lifecycle: pending -> succeeded/failed,
// tracking duration, responses, and error details.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::ConnectorCallHandler;
use serde_json::json;
use std::sync::atomic::{AtomicU64, Ordering};

static COUNTER: AtomicU64 = AtomicU64::new(0);

fn next_id() -> String {
    let n = COUNTER.fetch_add(1, Ordering::SeqCst) + 1;
    format!("cc-{}", n)
}

pub struct ConnectorCallHandlerImpl;

#[async_trait]
impl ConnectorCallHandler for ConnectorCallHandlerImpl {
    async fn invoke(
        &self,
        input: ConnectorCallInvokeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ConnectorCallInvokeOutput, Box<dyn std::error::Error>> {
        if input.connector.is_empty() || input.action.is_empty() {
            return Ok(ConnectorCallInvokeOutput::ValidationError {
                message: "Connector and action must not be empty".to_string(),
            });
        }

        let call_id = next_id();
        let now = chrono::Utc::now();

        storage.put("connector_call", &call_id, json!({
            "callId": call_id,
            "connector": input.connector,
            "action": input.action,
            "payload": input.payload,
            "timeoutMs": input.timeout_ms.unwrap_or(30000),
            "correlationId": input.correlation_id,
            "status": "pending",
            "invokedAt": now.to_rfc3339(),
            "invokedAtMs": now.timestamp_millis(),
        })).await?;

        Ok(ConnectorCallInvokeOutput::Ok {
            call_id,
            status: "pending".to_string(),
        })
    }

    async fn mark_success(
        &self,
        input: ConnectorCallMarkSuccessInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ConnectorCallMarkSuccessOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("connector_call", &input.call_id).await?;
        let record = match existing {
            Some(r) => r,
            None => return Ok(ConnectorCallMarkSuccessOutput::NotFound {
                call_id: input.call_id,
            }),
        };

        let status = record["status"].as_str().unwrap_or("");
        if status != "pending" {
            return Ok(ConnectorCallMarkSuccessOutput::AlreadyCompleted {
                call_id: input.call_id,
                current_status: status.to_string(),
            });
        }

        let now = chrono::Utc::now();
        let invoked_at_ms = record["invokedAtMs"].as_i64().unwrap_or(0);
        let duration_ms = now.timestamp_millis() - invoked_at_ms;

        let mut updated = record.clone();
        updated["status"] = json!("succeeded");
        updated["response"] = json!(input.response);
        updated["statusCode"] = json!(input.status_code.unwrap_or(200));
        updated["completedAt"] = json!(now.to_rfc3339());
        updated["durationMs"] = json!(duration_ms);
        storage.put("connector_call", &input.call_id, updated).await?;

        Ok(ConnectorCallMarkSuccessOutput::Ok {
            call_id: input.call_id,
            status: "succeeded".to_string(),
        })
    }

    async fn mark_failure(
        &self,
        input: ConnectorCallMarkFailureInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ConnectorCallMarkFailureOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("connector_call", &input.call_id).await?;
        let record = match existing {
            Some(r) => r,
            None => return Ok(ConnectorCallMarkFailureOutput::NotFound {
                call_id: input.call_id,
            }),
        };

        let status = record["status"].as_str().unwrap_or("");
        if status != "pending" {
            return Ok(ConnectorCallMarkFailureOutput::AlreadyCompleted {
                call_id: input.call_id,
                current_status: status.to_string(),
            });
        }

        let now = chrono::Utc::now();
        let invoked_at_ms = record["invokedAtMs"].as_i64().unwrap_or(0);
        let duration_ms = now.timestamp_millis() - invoked_at_ms;

        let mut updated = record.clone();
        updated["status"] = json!("failed");
        updated["error"] = json!(input.error);
        updated["errorCode"] = json!(input.error_code);
        updated["retryable"] = json!(input.retryable.unwrap_or(false));
        updated["completedAt"] = json!(now.to_rfc3339());
        updated["durationMs"] = json!(duration_ms);
        storage.put("connector_call", &input.call_id, updated).await?;

        Ok(ConnectorCallMarkFailureOutput::Ok {
            call_id: input.call_id,
            status: "failed".to_string(),
        })
    }

    async fn get_result(
        &self,
        input: ConnectorCallGetResultInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ConnectorCallGetResultOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("connector_call", &input.call_id).await?;
        let record = match existing {
            Some(r) => r,
            None => return Ok(ConnectorCallGetResultOutput::NotFound {
                call_id: input.call_id,
            }),
        };

        let response = record["response"].as_str().map(|s| s.to_string());
        let error = record["error"].as_str().map(|s| s.to_string());

        Ok(ConnectorCallGetResultOutput::Ok {
            call_id: input.call_id,
            status: record["status"].as_str().unwrap_or("").to_string(),
            connector: record["connector"].as_str().unwrap_or("").to_string(),
            response,
            error,
            duration_ms: record["durationMs"].as_i64().unwrap_or(0),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_invoke_connector() {
        let storage = InMemoryStorage::new();
        let handler = ConnectorCallHandlerImpl;
        let result = handler.invoke(
            ConnectorCallInvokeInput {
                connector: "stripe".into(),
                action: "create_charge".into(),
                payload: r#"{"amount":1000}"#.into(),
                timeout_ms: Some(5000),
                correlation_id: Some("order-123".into()),
            },
            &storage,
        ).await.unwrap();
        match result {
            ConnectorCallInvokeOutput::Ok { call_id, status } => {
                assert!(!call_id.is_empty());
                assert_eq!(status, "pending");
            }
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_mark_success() {
        let storage = InMemoryStorage::new();
        let handler = ConnectorCallHandlerImpl;

        let inv = handler.invoke(
            ConnectorCallInvokeInput {
                connector: "slack".into(), action: "post_message".into(),
                payload: "{}".into(), timeout_ms: None, correlation_id: None,
            },
            &storage,
        ).await.unwrap();
        let id = match inv { ConnectorCallInvokeOutput::Ok { call_id, .. } => call_id, _ => panic!("Expected Ok") };

        let result = handler.mark_success(
            ConnectorCallMarkSuccessInput { call_id: id.clone(), response: r#"{"ok":true}"#.into(), status_code: Some(200) },
            &storage,
        ).await.unwrap();
        match result {
            ConnectorCallMarkSuccessOutput::Ok { status, .. } => assert_eq!(status, "succeeded"),
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_mark_failure() {
        let storage = InMemoryStorage::new();
        let handler = ConnectorCallHandlerImpl;

        let inv = handler.invoke(
            ConnectorCallInvokeInput {
                connector: "email".into(), action: "send".into(),
                payload: "{}".into(), timeout_ms: None, correlation_id: None,
            },
            &storage,
        ).await.unwrap();
        let id = match inv { ConnectorCallInvokeOutput::Ok { call_id, .. } => call_id, _ => panic!("Expected Ok") };

        let result = handler.mark_failure(
            ConnectorCallMarkFailureInput {
                call_id: id.clone(),
                error: "Connection timeout".into(),
                error_code: Some("ETIMEOUT".into()),
                retryable: Some(true),
            },
            &storage,
        ).await.unwrap();
        match result {
            ConnectorCallMarkFailureOutput::Ok { status, .. } => assert_eq!(status, "failed"),
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_get_result_after_success() {
        let storage = InMemoryStorage::new();
        let handler = ConnectorCallHandlerImpl;

        let inv = handler.invoke(
            ConnectorCallInvokeInput {
                connector: "api".into(), action: "fetch".into(),
                payload: "{}".into(), timeout_ms: None, correlation_id: None,
            },
            &storage,
        ).await.unwrap();
        let id = match inv { ConnectorCallInvokeOutput::Ok { call_id, .. } => call_id, _ => panic!("Expected Ok") };

        handler.mark_success(
            ConnectorCallMarkSuccessInput { call_id: id.clone(), response: "data".into(), status_code: None },
            &storage,
        ).await.unwrap();

        let result = handler.get_result(
            ConnectorCallGetResultInput { call_id: id.clone() },
            &storage,
        ).await.unwrap();
        match result {
            ConnectorCallGetResultOutput::Ok { status, connector, response, .. } => {
                assert_eq!(status, "succeeded");
                assert_eq!(connector, "api");
                assert_eq!(response, Some("data".to_string()));
            }
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_double_success_rejected() {
        let storage = InMemoryStorage::new();
        let handler = ConnectorCallHandlerImpl;

        let inv = handler.invoke(
            ConnectorCallInvokeInput {
                connector: "svc".into(), action: "call".into(),
                payload: "{}".into(), timeout_ms: None, correlation_id: None,
            },
            &storage,
        ).await.unwrap();
        let id = match inv { ConnectorCallInvokeOutput::Ok { call_id, .. } => call_id, _ => panic!("Expected Ok") };

        handler.mark_success(
            ConnectorCallMarkSuccessInput { call_id: id.clone(), response: "ok".into(), status_code: None },
            &storage,
        ).await.unwrap();

        let result = handler.mark_success(
            ConnectorCallMarkSuccessInput { call_id: id.clone(), response: "ok2".into(), status_code: None },
            &storage,
        ).await.unwrap();
        match result {
            ConnectorCallMarkSuccessOutput::AlreadyCompleted { .. } => {}
            _ => panic!("Expected AlreadyCompleted variant"),
        }
    }

    #[tokio::test]
    async fn test_get_result_not_found() {
        let storage = InMemoryStorage::new();
        let handler = ConnectorCallHandlerImpl;
        let result = handler.get_result(
            ConnectorCallGetResultInput { call_id: "nonexistent".into() },
            &storage,
        ).await.unwrap();
        match result {
            ConnectorCallGetResultOutput::NotFound { .. } => {}
            _ => panic!("Expected NotFound variant"),
        }
    }
}
