// generated: flow_token/conformance.rs
// Conformance tests for FlowToken concept invariants.

#[cfg(test)]
mod tests {
    use super::super::handler::FlowTokenHandler;
    use super::super::r#impl::FlowTokenHandlerImpl;
    use super::super::types::*;
    use crate::storage::InMemoryStorage;
    use serde_json::json;

    fn create_test_handler() -> FlowTokenHandlerImpl {
        FlowTokenHandlerImpl
    }

    #[tokio::test]
    async fn flow_token_invariant_emit_then_count() {
        // Invariant: after emitting N tokens, count_active returns N
        let storage = InMemoryStorage::new();
        let handler = create_test_handler();

        for i in 0..3 {
            handler.emit(
                FlowTokenEmitInput {
                    run_ref: "run-inv-001".to_string(),
                    node_ref: format!("node-{}", i),
                    token_type: None,
                    payload: None,
                },
                &storage,
            ).await.unwrap();
        }

        let result = handler.count_active(
            FlowTokenCountActiveInput {
                run_ref: "run-inv-001".to_string(),
            },
            &storage,
        ).await.unwrap();

        match result {
            FlowTokenCountActiveOutput::Ok { count } => {
                assert_eq!(count, 3);
            }
        }
    }

    #[tokio::test]
    async fn flow_token_invariant_consume_decrements_active() {
        // Invariant: consuming a token decrements active count by 1
        let storage = InMemoryStorage::new();
        let handler = create_test_handler();

        let emit_result = handler.emit(
            FlowTokenEmitInput {
                run_ref: "run-inv-002".to_string(),
                node_ref: "node-a".to_string(),
                token_type: None,
                payload: None,
            },
            &storage,
        ).await.unwrap();

        handler.emit(
            FlowTokenEmitInput {
                run_ref: "run-inv-002".to_string(),
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
                token_id,
                run_ref: "run-inv-002".to_string(),
            },
            &storage,
        ).await.unwrap();

        let result = handler.count_active(
            FlowTokenCountActiveInput {
                run_ref: "run-inv-002".to_string(),
            },
            &storage,
        ).await.unwrap();

        match result {
            FlowTokenCountActiveOutput::Ok { count } => {
                assert_eq!(count, 1);
            }
        }
    }

    #[tokio::test]
    async fn flow_token_invariant_kill_removes_from_active() {
        // Invariant: killing a token removes it from active list
        let storage = InMemoryStorage::new();
        let handler = create_test_handler();

        let emit_result = handler.emit(
            FlowTokenEmitInput {
                run_ref: "run-inv-003".to_string(),
                node_ref: "node-x".to_string(),
                token_type: None,
                payload: None,
            },
            &storage,
        ).await.unwrap();

        let token_id = match emit_result {
            FlowTokenEmitOutput::Ok { token_id, .. } => token_id,
        };

        handler.kill(
            FlowTokenKillInput {
                token_id,
                run_ref: "run-inv-003".to_string(),
                reason: Some("test cancellation".to_string()),
            },
            &storage,
        ).await.unwrap();

        let result = handler.list_active(
            FlowTokenListActiveInput {
                run_ref: "run-inv-003".to_string(),
            },
            &storage,
        ).await.unwrap();

        match result {
            FlowTokenListActiveOutput::Ok { tokens } => {
                assert!(tokens.is_empty());
            }
        }
    }

    #[tokio::test]
    async fn flow_token_invariant_double_consume_rejected() {
        // Invariant: consuming a token twice returns AlreadyConsumed
        let storage = InMemoryStorage::new();
        let handler = create_test_handler();

        let emit_result = handler.emit(
            FlowTokenEmitInput {
                run_ref: "run-inv-004".to_string(),
                node_ref: "node-z".to_string(),
                token_type: None,
                payload: None,
            },
            &storage,
        ).await.unwrap();

        let token_id = match emit_result {
            FlowTokenEmitOutput::Ok { token_id, .. } => token_id,
        };

        let first = handler.consume(
            FlowTokenConsumeInput {
                token_id: token_id.clone(),
                run_ref: "run-inv-004".to_string(),
            },
            &storage,
        ).await.unwrap();

        match first {
            FlowTokenConsumeOutput::Ok { .. } => {}
            _ => panic!("Expected first consume to succeed"),
        }

        let second = handler.consume(
            FlowTokenConsumeInput {
                token_id: token_id.clone(),
                run_ref: "run-inv-004".to_string(),
            },
            &storage,
        ).await.unwrap();

        match second {
            FlowTokenConsumeOutput::AlreadyConsumed { .. } => {}
            _ => panic!("Expected second consume to return AlreadyConsumed"),
        }
    }
}
