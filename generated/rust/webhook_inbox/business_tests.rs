// Business logic tests for WebhookInbox concept.
// Validates correlation matching, lifecycle state machine,
// multiple registrations, and edge cases in receive/ack/expire transitions.

#[cfg(test)]
mod tests {
    use super::super::handler::WebhookInboxHandler;
    use super::super::r#impl::WebhookInboxHandlerImpl;
    use super::super::types::*;
    use crate::storage::InMemoryStorage;
    use serde_json::json;

    #[tokio::test]
    async fn test_receive_does_not_match_wrong_event_type() {
        let storage = InMemoryStorage::new();
        let handler = WebhookInboxHandlerImpl;

        handler.register(WebhookInboxRegisterInput {
            run_ref: "run-001".to_string(),
            step_ref: "wait-payment".to_string(),
            event_type: "payment.completed".to_string(),
            correlation_key: "order-100".to_string(),
        }, &storage).await.unwrap();

        let result = handler.receive(WebhookInboxReceiveInput {
            correlation_key: "order-100".to_string(),
            event_type: "payment.failed".to_string(),
            payload: json!({"error": "declined"}),
        }, &storage).await.unwrap();
        match result {
            WebhookInboxReceiveOutput::NoMatch { correlation_key } => {
                assert_eq!(correlation_key, "order-100");
            }
            _ => panic!("Expected NoMatch for wrong event type"),
        }
    }

    #[tokio::test]
    async fn test_receive_does_not_match_wrong_correlation_key() {
        let storage = InMemoryStorage::new();
        let handler = WebhookInboxHandlerImpl;

        handler.register(WebhookInboxRegisterInput {
            run_ref: "run-002".to_string(),
            step_ref: "wait".to_string(),
            event_type: "callback".to_string(),
            correlation_key: "key-A".to_string(),
        }, &storage).await.unwrap();

        let result = handler.receive(WebhookInboxReceiveInput {
            correlation_key: "key-B".to_string(),
            event_type: "callback".to_string(),
            payload: json!({}),
        }, &storage).await.unwrap();
        match result {
            WebhookInboxReceiveOutput::NoMatch { .. } => {}
            _ => panic!("Expected NoMatch for wrong correlation key"),
        }
    }

    #[tokio::test]
    async fn test_receive_already_received_does_not_match() {
        // Once a hook is received, a second receive for the same key should not match
        let storage = InMemoryStorage::new();
        let handler = WebhookInboxHandlerImpl;

        handler.register(WebhookInboxRegisterInput {
            run_ref: "run-003".to_string(),
            step_ref: "wait".to_string(),
            event_type: "event.x".to_string(),
            correlation_key: "key-once".to_string(),
        }, &storage).await.unwrap();

        handler.receive(WebhookInboxReceiveInput {
            correlation_key: "key-once".to_string(),
            event_type: "event.x".to_string(),
            payload: json!({"first": true}),
        }, &storage).await.unwrap();

        let result = handler.receive(WebhookInboxReceiveInput {
            correlation_key: "key-once".to_string(),
            event_type: "event.x".to_string(),
            payload: json!({"second": true}),
        }, &storage).await.unwrap();
        match result {
            WebhookInboxReceiveOutput::NoMatch { .. } => {}
            _ => panic!("Expected NoMatch for already-received hook"),
        }
    }

    #[tokio::test]
    async fn test_expire_already_received_returns_not_waiting() {
        let storage = InMemoryStorage::new();
        let handler = WebhookInboxHandlerImpl;

        let reg = handler.register(WebhookInboxRegisterInput {
            run_ref: "run-004".to_string(),
            step_ref: "wait".to_string(),
            event_type: "ev".to_string(),
            correlation_key: "k".to_string(),
        }, &storage).await.unwrap();
        let hook_id = match reg {
            WebhookInboxRegisterOutput::Ok { hook_id, .. } => hook_id,
        };

        handler.receive(WebhookInboxReceiveInput {
            correlation_key: "k".to_string(),
            event_type: "ev".to_string(),
            payload: json!({}),
        }, &storage).await.unwrap();

        let result = handler.expire(WebhookInboxExpireInput {
            hook_id: hook_id.clone(),
        }, &storage).await.unwrap();
        match result {
            WebhookInboxExpireOutput::NotWaiting { current_status, .. } => {
                assert_eq!(current_status, "received");
            }
            _ => panic!("Expected NotWaiting"),
        }
    }

    #[tokio::test]
    async fn test_ack_after_expire_returns_not_received() {
        let storage = InMemoryStorage::new();
        let handler = WebhookInboxHandlerImpl;

        let reg = handler.register(WebhookInboxRegisterInput {
            run_ref: "run-005".to_string(),
            step_ref: "wait".to_string(),
            event_type: "ev".to_string(),
            correlation_key: "k2".to_string(),
        }, &storage).await.unwrap();
        let hook_id = match reg {
            WebhookInboxRegisterOutput::Ok { hook_id, .. } => hook_id,
        };

        handler.expire(WebhookInboxExpireInput {
            hook_id: hook_id.clone(),
        }, &storage).await.unwrap();

        let result = handler.ack(WebhookInboxAckInput {
            hook_id: hook_id.clone(),
        }, &storage).await.unwrap();
        match result {
            WebhookInboxAckOutput::NotReceived { current_status, .. } => {
                assert_eq!(current_status, "expired");
            }
            _ => panic!("Expected NotReceived"),
        }
    }

    #[tokio::test]
    async fn test_double_ack_returns_not_received() {
        let storage = InMemoryStorage::new();
        let handler = WebhookInboxHandlerImpl;

        let reg = handler.register(WebhookInboxRegisterInput {
            run_ref: "run-006".to_string(),
            step_ref: "wait".to_string(),
            event_type: "ev".to_string(),
            correlation_key: "ack-twice".to_string(),
        }, &storage).await.unwrap();
        let hook_id = match reg {
            WebhookInboxRegisterOutput::Ok { hook_id, .. } => hook_id,
        };

        handler.receive(WebhookInboxReceiveInput {
            correlation_key: "ack-twice".to_string(),
            event_type: "ev".to_string(),
            payload: json!({}),
        }, &storage).await.unwrap();

        handler.ack(WebhookInboxAckInput {
            hook_id: hook_id.clone(),
        }, &storage).await.unwrap();

        let result = handler.ack(WebhookInboxAckInput {
            hook_id: hook_id.clone(),
        }, &storage).await.unwrap();
        match result {
            WebhookInboxAckOutput::NotReceived { current_status, .. } => {
                assert_eq!(current_status, "acknowledged");
            }
            _ => panic!("Expected NotReceived for already acked"),
        }
    }

    #[tokio::test]
    async fn test_expire_nonexistent_returns_not_found() {
        let storage = InMemoryStorage::new();
        let handler = WebhookInboxHandlerImpl;

        let result = handler.expire(WebhookInboxExpireInput {
            hook_id: "hook-missing".to_string(),
        }, &storage).await.unwrap();
        match result {
            WebhookInboxExpireOutput::NotFound { .. } => {}
            _ => panic!("Expected NotFound"),
        }
    }

    #[tokio::test]
    async fn test_ack_nonexistent_returns_not_found() {
        let storage = InMemoryStorage::new();
        let handler = WebhookInboxHandlerImpl;

        let result = handler.ack(WebhookInboxAckInput {
            hook_id: "hook-ghost".to_string(),
        }, &storage).await.unwrap();
        match result {
            WebhookInboxAckOutput::NotFound { .. } => {}
            _ => panic!("Expected NotFound"),
        }
    }

    #[tokio::test]
    async fn test_full_lifecycle_register_receive_ack() {
        let storage = InMemoryStorage::new();
        let handler = WebhookInboxHandlerImpl;

        let reg = handler.register(WebhookInboxRegisterInput {
            run_ref: "run-full".to_string(),
            step_ref: "payment-wait".to_string(),
            event_type: "payment.success".to_string(),
            correlation_key: "invoice-999".to_string(),
        }, &storage).await.unwrap();
        let hook_id = match reg {
            WebhookInboxRegisterOutput::Ok { hook_id, status, .. } => {
                assert_eq!(status, "waiting");
                hook_id
            }
        };

        let recv = handler.receive(WebhookInboxReceiveInput {
            correlation_key: "invoice-999".to_string(),
            event_type: "payment.success".to_string(),
            payload: json!({"amount": 250.00, "currency": "USD"}),
        }, &storage).await.unwrap();
        match recv {
            WebhookInboxReceiveOutput::Ok { run_ref, step_ref, payload, .. } => {
                assert_eq!(run_ref, "run-full");
                assert_eq!(step_ref, "payment-wait");
                assert_eq!(payload["amount"], json!(250.0));
            }
            _ => panic!("Expected Ok"),
        }

        let ack = handler.ack(WebhookInboxAckInput {
            hook_id: hook_id.clone(),
        }, &storage).await.unwrap();
        match ack {
            WebhookInboxAckOutput::Ok { .. } => {}
            _ => panic!("Expected Ok"),
        }
    }

    #[tokio::test]
    async fn test_expire_already_expired_returns_not_waiting() {
        let storage = InMemoryStorage::new();
        let handler = WebhookInboxHandlerImpl;

        let reg = handler.register(WebhookInboxRegisterInput {
            run_ref: "run-exp".to_string(),
            step_ref: "wait".to_string(),
            event_type: "ev".to_string(),
            correlation_key: "exp-k".to_string(),
        }, &storage).await.unwrap();
        let hook_id = match reg {
            WebhookInboxRegisterOutput::Ok { hook_id, .. } => hook_id,
        };

        handler.expire(WebhookInboxExpireInput {
            hook_id: hook_id.clone(),
        }, &storage).await.unwrap();

        let result = handler.expire(WebhookInboxExpireInput {
            hook_id: hook_id.clone(),
        }, &storage).await.unwrap();
        match result {
            WebhookInboxExpireOutput::NotWaiting { current_status, .. } => {
                assert_eq!(current_status, "expired");
            }
            _ => panic!("Expected NotWaiting for double expire"),
        }
    }
}
