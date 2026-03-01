// ConnectorCall concept conformance tests
// Validates connector call invariants: pending -> succeeded/failed transitions,
// idempotency of completion, and result retrieval consistency.

#[cfg(test)]
mod tests {
    use super::super::handler::ConnectorCallHandler;
    use super::super::r#impl::ConnectorCallHandlerImpl;
    use super::super::types::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn connector_call_success_lifecycle_invariant() {
        // Invariant: invoke -> mark_success -> get_result returns succeeded with response
        let storage = InMemoryStorage::new();
        let handler = ConnectorCallHandlerImpl;

        let inv = handler.invoke(
            ConnectorCallInvokeInput {
                connector: "payment-gateway".into(),
                action: "charge".into(),
                payload: r#"{"amount":5000}"#.into(),
                timeout_ms: Some(10000),
                correlation_id: Some("order-42".into()),
            },
            &storage,
        ).await.unwrap();
        let id = match inv {
            ConnectorCallInvokeOutput::Ok { call_id, status } => {
                assert_eq!(status, "pending");
                call_id
            }
            other => panic!("Expected Ok, got {:?}", other),
        };

        handler.mark_success(
            ConnectorCallMarkSuccessInput {
                call_id: id.clone(),
                response: r#"{"charge_id":"ch_123"}"#.into(),
                status_code: Some(200),
            },
            &storage,
        ).await.unwrap();

        let result = handler.get_result(
            ConnectorCallGetResultInput { call_id: id.clone() },
            &storage,
        ).await.unwrap();
        match result {
            ConnectorCallGetResultOutput::Ok { status, connector, response, error, .. } => {
                assert_eq!(status, "succeeded");
                assert_eq!(connector, "payment-gateway");
                assert!(response.is_some());
                assert!(error.is_none());
            }
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

    #[tokio::test]
    async fn connector_call_failure_lifecycle_invariant() {
        // Invariant: invoke -> mark_failure -> get_result returns failed with error
        let storage = InMemoryStorage::new();
        let handler = ConnectorCallHandlerImpl;

        let inv = handler.invoke(
            ConnectorCallInvokeInput {
                connector: "email-service".into(),
                action: "send".into(),
                payload: "{}".into(),
                timeout_ms: None,
                correlation_id: None,
            },
            &storage,
        ).await.unwrap();
        let id = match inv {
            ConnectorCallInvokeOutput::Ok { call_id, .. } => call_id,
            other => panic!("Expected Ok, got {:?}", other),
        };

        handler.mark_failure(
            ConnectorCallMarkFailureInput {
                call_id: id.clone(),
                error: "SMTP server unreachable".into(),
                error_code: Some("ECONNREFUSED".into()),
                retryable: Some(true),
            },
            &storage,
        ).await.unwrap();

        let result = handler.get_result(
            ConnectorCallGetResultInput { call_id: id.clone() },
            &storage,
        ).await.unwrap();
        match result {
            ConnectorCallGetResultOutput::Ok { status, error, .. } => {
                assert_eq!(status, "failed");
                assert!(error.is_some());
            }
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

    #[tokio::test]
    async fn connector_call_completion_is_idempotent_invariant() {
        // Invariant: once completed (succeeded/failed), further completions are rejected
        let storage = InMemoryStorage::new();
        let handler = ConnectorCallHandlerImpl;

        let inv = handler.invoke(
            ConnectorCallInvokeInput {
                connector: "svc".into(), action: "op".into(),
                payload: "{}".into(), timeout_ms: None, correlation_id: None,
            },
            &storage,
        ).await.unwrap();
        let id = match inv { ConnectorCallInvokeOutput::Ok { call_id, .. } => call_id, other => panic!("Expected Ok, got {:?}", other) };

        handler.mark_success(
            ConnectorCallMarkSuccessInput { call_id: id.clone(), response: "ok".into(), status_code: None },
            &storage,
        ).await.unwrap();

        let fail_after = handler.mark_failure(
            ConnectorCallMarkFailureInput { call_id: id.clone(), error: "late error".into(), error_code: None, retryable: None },
            &storage,
        ).await.unwrap();
        match fail_after {
            ConnectorCallMarkFailureOutput::AlreadyCompleted { current_status, .. } => {
                assert_eq!(current_status, "succeeded");
            }
            other => panic!("Expected AlreadyCompleted, got {:?}", other),
        }
    }
}
