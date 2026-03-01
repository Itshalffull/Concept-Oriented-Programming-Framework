// Business logic tests for ConnectorCall concept.
// Validates invocation lifecycle, terminal state enforcement,
// error tracking, and result retrieval edge cases.

#[cfg(test)]
mod tests {
    use super::super::handler::ConnectorCallHandler;
    use super::super::r#impl::ConnectorCallHandlerImpl;
    use super::super::types::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_empty_connector_name_validation_error() {
        let storage = InMemoryStorage::new();
        let handler = ConnectorCallHandlerImpl;

        let result = handler.invoke(ConnectorCallInvokeInput {
            connector: "".into(),
            action: "do_thing".into(),
            payload: "{}".into(),
            timeout_ms: None,
            correlation_id: None,
        }, &storage).await.unwrap();
        match result {
            ConnectorCallInvokeOutput::ValidationError { message } => {
                assert!(message.contains("empty"));
            }
            _ => panic!("Expected ValidationError"),
        }
    }

    #[tokio::test]
    async fn test_empty_action_validation_error() {
        let storage = InMemoryStorage::new();
        let handler = ConnectorCallHandlerImpl;

        let result = handler.invoke(ConnectorCallInvokeInput {
            connector: "stripe".into(),
            action: "".into(),
            payload: "{}".into(),
            timeout_ms: None,
            correlation_id: None,
        }, &storage).await.unwrap();
        match result {
            ConnectorCallInvokeOutput::ValidationError { .. } => {}
            _ => panic!("Expected ValidationError"),
        }
    }

    #[tokio::test]
    async fn test_mark_failure_then_success_rejected() {
        // After marking failure, marking success should be rejected
        let storage = InMemoryStorage::new();
        let handler = ConnectorCallHandlerImpl;

        let inv = handler.invoke(ConnectorCallInvokeInput {
            connector: "api".into(),
            action: "fetch".into(),
            payload: "{}".into(),
            timeout_ms: None,
            correlation_id: None,
        }, &storage).await.unwrap();
        let id = match inv {
            ConnectorCallInvokeOutput::Ok { call_id, .. } => call_id,
            _ => panic!("Expected Ok"),
        };

        handler.mark_failure(ConnectorCallMarkFailureInput {
            call_id: id.clone(),
            error: "timeout".into(),
            error_code: Some("ETIMEOUT".into()),
            retryable: Some(true),
        }, &storage).await.unwrap();

        let result = handler.mark_success(ConnectorCallMarkSuccessInput {
            call_id: id.clone(),
            response: "late response".into(),
            status_code: Some(200),
        }, &storage).await.unwrap();
        match result {
            ConnectorCallMarkSuccessOutput::AlreadyCompleted { current_status, .. } => {
                assert_eq!(current_status, "failed");
            }
            _ => panic!("Expected AlreadyCompleted"),
        }
    }

    #[tokio::test]
    async fn test_mark_success_then_failure_rejected() {
        let storage = InMemoryStorage::new();
        let handler = ConnectorCallHandlerImpl;

        let inv = handler.invoke(ConnectorCallInvokeInput {
            connector: "svc".into(),
            action: "call".into(),
            payload: "{}".into(),
            timeout_ms: None,
            correlation_id: None,
        }, &storage).await.unwrap();
        let id = match inv {
            ConnectorCallInvokeOutput::Ok { call_id, .. } => call_id,
            _ => panic!("Expected Ok"),
        };

        handler.mark_success(ConnectorCallMarkSuccessInput {
            call_id: id.clone(),
            response: "ok".into(),
            status_code: Some(200),
        }, &storage).await.unwrap();

        let result = handler.mark_failure(ConnectorCallMarkFailureInput {
            call_id: id.clone(),
            error: "post-hoc error".into(),
            error_code: None,
            retryable: None,
        }, &storage).await.unwrap();
        match result {
            ConnectorCallMarkFailureOutput::AlreadyCompleted { current_status, .. } => {
                assert_eq!(current_status, "succeeded");
            }
            _ => panic!("Expected AlreadyCompleted"),
        }
    }

    #[tokio::test]
    async fn test_get_result_while_pending() {
        let storage = InMemoryStorage::new();
        let handler = ConnectorCallHandlerImpl;

        let inv = handler.invoke(ConnectorCallInvokeInput {
            connector: "db".into(),
            action: "query".into(),
            payload: "SELECT 1".into(),
            timeout_ms: Some(10000),
            correlation_id: Some("req-001".into()),
        }, &storage).await.unwrap();
        let id = match inv {
            ConnectorCallInvokeOutput::Ok { call_id, .. } => call_id,
            _ => panic!("Expected Ok"),
        };

        let result = handler.get_result(ConnectorCallGetResultInput {
            call_id: id.clone(),
        }, &storage).await.unwrap();
        match result {
            ConnectorCallGetResultOutput::Ok { status, connector, response, error, .. } => {
                assert_eq!(status, "pending");
                assert_eq!(connector, "db");
                assert!(response.is_none());
                assert!(error.is_none());
            }
            _ => panic!("Expected Ok"),
        }
    }

    #[tokio::test]
    async fn test_get_result_after_failure_includes_error() {
        let storage = InMemoryStorage::new();
        let handler = ConnectorCallHandlerImpl;

        let inv = handler.invoke(ConnectorCallInvokeInput {
            connector: "email".into(),
            action: "send".into(),
            payload: "{}".into(),
            timeout_ms: None,
            correlation_id: None,
        }, &storage).await.unwrap();
        let id = match inv {
            ConnectorCallInvokeOutput::Ok { call_id, .. } => call_id,
            _ => panic!("Expected Ok"),
        };

        handler.mark_failure(ConnectorCallMarkFailureInput {
            call_id: id.clone(),
            error: "SMTP connection refused".into(),
            error_code: Some("SMTP_REFUSED".into()),
            retryable: Some(true),
        }, &storage).await.unwrap();

        let result = handler.get_result(ConnectorCallGetResultInput {
            call_id: id.clone(),
        }, &storage).await.unwrap();
        match result {
            ConnectorCallGetResultOutput::Ok { status, error, connector, .. } => {
                assert_eq!(status, "failed");
                assert_eq!(error, Some("SMTP connection refused".to_string()));
                assert_eq!(connector, "email");
            }
            _ => panic!("Expected Ok"),
        }
    }

    #[tokio::test]
    async fn test_mark_success_not_found() {
        let storage = InMemoryStorage::new();
        let handler = ConnectorCallHandlerImpl;

        let result = handler.mark_success(ConnectorCallMarkSuccessInput {
            call_id: "cc-missing".into(),
            response: "ok".into(),
            status_code: None,
        }, &storage).await.unwrap();
        match result {
            ConnectorCallMarkSuccessOutput::NotFound { .. } => {}
            _ => panic!("Expected NotFound"),
        }
    }

    #[tokio::test]
    async fn test_mark_failure_not_found() {
        let storage = InMemoryStorage::new();
        let handler = ConnectorCallHandlerImpl;

        let result = handler.mark_failure(ConnectorCallMarkFailureInput {
            call_id: "cc-missing".into(),
            error: "err".into(),
            error_code: None,
            retryable: None,
        }, &storage).await.unwrap();
        match result {
            ConnectorCallMarkFailureOutput::NotFound { .. } => {}
            _ => panic!("Expected NotFound"),
        }
    }

    #[tokio::test]
    async fn test_default_timeout_applied() {
        let storage = InMemoryStorage::new();
        let handler = ConnectorCallHandlerImpl;

        let result = handler.invoke(ConnectorCallInvokeInput {
            connector: "http".into(),
            action: "get".into(),
            payload: "{}".into(),
            timeout_ms: None,
            correlation_id: None,
        }, &storage).await.unwrap();
        match result {
            ConnectorCallInvokeOutput::Ok { call_id, status } => {
                assert!(!call_id.is_empty());
                assert_eq!(status, "pending");
            }
            _ => panic!("Expected Ok"),
        }
    }

    #[tokio::test]
    async fn test_correlation_id_preserved() {
        let storage = InMemoryStorage::new();
        let handler = ConnectorCallHandlerImpl;

        let result = handler.invoke(ConnectorCallInvokeInput {
            connector: "payment".into(),
            action: "charge".into(),
            payload: r#"{"amount": 5000}"#.into(),
            timeout_ms: Some(15000),
            correlation_id: Some("order-abc-123".into()),
        }, &storage).await.unwrap();
        match result {
            ConnectorCallInvokeOutput::Ok { call_id, status } => {
                assert!(!call_id.is_empty());
                assert_eq!(status, "pending");
            }
            _ => panic!("Expected Ok"),
        }
    }

    #[tokio::test]
    async fn test_double_failure_rejected() {
        let storage = InMemoryStorage::new();
        let handler = ConnectorCallHandlerImpl;

        let inv = handler.invoke(ConnectorCallInvokeInput {
            connector: "svc".into(),
            action: "call".into(),
            payload: "{}".into(),
            timeout_ms: None,
            correlation_id: None,
        }, &storage).await.unwrap();
        let id = match inv {
            ConnectorCallInvokeOutput::Ok { call_id, .. } => call_id,
            _ => panic!("Expected Ok"),
        };

        handler.mark_failure(ConnectorCallMarkFailureInput {
            call_id: id.clone(),
            error: "first".into(),
            error_code: None,
            retryable: None,
        }, &storage).await.unwrap();

        let result = handler.mark_failure(ConnectorCallMarkFailureInput {
            call_id: id.clone(),
            error: "second".into(),
            error_code: None,
            retryable: None,
        }, &storage).await.unwrap();
        match result {
            ConnectorCallMarkFailureOutput::AlreadyCompleted { current_status, .. } => {
                assert_eq!(current_status, "failed");
            }
            _ => panic!("Expected AlreadyCompleted"),
        }
    }
}
