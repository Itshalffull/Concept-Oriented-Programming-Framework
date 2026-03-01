// generated: webhook_inbox/conformance.rs
// Conformance tests for WebhookInbox concept invariants.

#[cfg(test)]
mod tests {
    use super::super::handler::WebhookInboxHandler;
    use super::super::r#impl::WebhookInboxHandlerImpl;
    use super::super::types::*;
    use crate::storage::InMemoryStorage;
    use serde_json::json;

    fn create_test_handler() -> WebhookInboxHandlerImpl {
        WebhookInboxHandlerImpl
    }

    #[tokio::test]
    async fn webhook_inbox_invariant_register_receive_ack() {
        // Invariant: register -> receive -> ack is the happy path
        let storage = InMemoryStorage::new();
        let handler = create_test_handler();

        let reg = handler.register(
            WebhookInboxRegisterInput {
                run_ref: "run-inv-001".to_string(),
                step_ref: "wait-payment".to_string(),
                event_type: "payment.done".to_string(),
                correlation_key: "order-100".to_string(),
            },
            &storage,
        ).await.unwrap();
        let hook_id = match reg {
            WebhookInboxRegisterOutput::Ok { hook_id, .. } => hook_id,
        };

        let recv = handler.receive(
            WebhookInboxReceiveInput {
                correlation_key: "order-100".to_string(),
                event_type: "payment.done".to_string(),
                payload: json!({ "amount": 5000 }),
            },
            &storage,
        ).await.unwrap();
        match recv {
            WebhookInboxReceiveOutput::Ok { run_ref, step_ref, .. } => {
                assert_eq!(run_ref, "run-inv-001");
                assert_eq!(step_ref, "wait-payment");
            }
            _ => panic!("Expected Ok"),
        }

        let ack = handler.ack(
            WebhookInboxAckInput { hook_id },
            &storage,
        ).await.unwrap();
        match ack {
            WebhookInboxAckOutput::Ok { .. } => {}
            _ => panic!("Expected Ok"),
        }
    }

    #[tokio::test]
    async fn webhook_inbox_invariant_expire_prevents_receive() {
        // Invariant: once expired, receive should not match
        let storage = InMemoryStorage::new();
        let handler = create_test_handler();

        let reg = handler.register(
            WebhookInboxRegisterInput {
                run_ref: "run-inv-002".to_string(),
                step_ref: "wait-cb".to_string(),
                event_type: "cb.event".to_string(),
                correlation_key: "unique-key".to_string(),
            },
            &storage,
        ).await.unwrap();
        let hook_id = match reg {
            WebhookInboxRegisterOutput::Ok { hook_id, .. } => hook_id,
        };

        handler.expire(
            WebhookInboxExpireInput { hook_id },
            &storage,
        ).await.unwrap();

        // Now receive should find no waiting hook
        let recv = handler.receive(
            WebhookInboxReceiveInput {
                correlation_key: "unique-key".to_string(),
                event_type: "cb.event".to_string(),
                payload: json!({}),
            },
            &storage,
        ).await.unwrap();
        match recv {
            WebhookInboxReceiveOutput::NoMatch { .. } => {}
            _ => panic!("Expected NoMatch after expire"),
        }
    }

    #[tokio::test]
    async fn webhook_inbox_invariant_double_receive_rejected() {
        // Invariant: only one receive per hook
        let storage = InMemoryStorage::new();
        let handler = create_test_handler();

        handler.register(
            WebhookInboxRegisterInput {
                run_ref: "run-inv-003".to_string(),
                step_ref: "step-a".to_string(),
                event_type: "event.x".to_string(),
                correlation_key: "dup-key".to_string(),
            },
            &storage,
        ).await.unwrap();

        handler.receive(
            WebhookInboxReceiveInput {
                correlation_key: "dup-key".to_string(),
                event_type: "event.x".to_string(),
                payload: json!({ "first": true }),
            },
            &storage,
        ).await.unwrap();

        let second = handler.receive(
            WebhookInboxReceiveInput {
                correlation_key: "dup-key".to_string(),
                event_type: "event.x".to_string(),
                payload: json!({ "second": true }),
            },
            &storage,
        ).await.unwrap();
        match second {
            WebhookInboxReceiveOutput::NoMatch { .. } => {}
            _ => panic!("Expected NoMatch for second receive"),
        }
    }
}
