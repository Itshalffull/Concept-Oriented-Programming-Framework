// Business logic tests for FlowToken concept.
// Validates token lifecycle, cross-run isolation, kill semantics,
// and active token counting under concurrent operations.

#[cfg(test)]
mod tests {
    use super::super::handler::FlowTokenHandler;
    use super::super::r#impl::FlowTokenHandlerImpl;
    use super::super::types::*;
    use crate::storage::InMemoryStorage;
    use serde_json::json;

    #[tokio::test]
    async fn test_tokens_scoped_to_run() {
        // Tokens in different runs should not affect each other's counts
        let storage = InMemoryStorage::new();
        let handler = FlowTokenHandlerImpl;

        handler.emit(FlowTokenEmitInput {
            run_ref: "run-a".to_string(),
            node_ref: "start".to_string(),
            token_type: None,
            payload: None,
        }, &storage).await.unwrap();
        handler.emit(FlowTokenEmitInput {
            run_ref: "run-a".to_string(),
            node_ref: "middle".to_string(),
            token_type: None,
            payload: None,
        }, &storage).await.unwrap();

        handler.emit(FlowTokenEmitInput {
            run_ref: "run-b".to_string(),
            node_ref: "start".to_string(),
            token_type: None,
            payload: None,
        }, &storage).await.unwrap();

        let count_a = handler.count_active(FlowTokenCountActiveInput {
            run_ref: "run-a".to_string(),
        }, &storage).await.unwrap();
        match count_a {
            FlowTokenCountActiveOutput::Ok { count } => assert_eq!(count, 2),
        }

        let count_b = handler.count_active(FlowTokenCountActiveInput {
            run_ref: "run-b".to_string(),
        }, &storage).await.unwrap();
        match count_b {
            FlowTokenCountActiveOutput::Ok { count } => assert_eq!(count, 1),
        }
    }

    #[tokio::test]
    async fn test_kill_consumed_token_returns_already_inactive() {
        let storage = InMemoryStorage::new();
        let handler = FlowTokenHandlerImpl;

        let emit = handler.emit(FlowTokenEmitInput {
            run_ref: "run-ki".to_string(),
            node_ref: "node-x".to_string(),
            token_type: None,
            payload: None,
        }, &storage).await.unwrap();
        let token_id = match emit {
            FlowTokenEmitOutput::Ok { token_id, .. } => token_id,
        };

        handler.consume(FlowTokenConsumeInput {
            token_id: token_id.clone(),
            run_ref: "run-ki".to_string(),
        }, &storage).await.unwrap();

        let result = handler.kill(FlowTokenKillInput {
            token_id: token_id.clone(),
            run_ref: "run-ki".to_string(),
            reason: Some("cleanup".to_string()),
        }, &storage).await.unwrap();
        match result {
            FlowTokenKillOutput::AlreadyInactive { status, .. } => {
                assert_eq!(status, "consumed");
            }
            _ => panic!("Expected AlreadyInactive"),
        }
    }

    #[tokio::test]
    async fn test_kill_killed_token_returns_already_inactive() {
        let storage = InMemoryStorage::new();
        let handler = FlowTokenHandlerImpl;

        let emit = handler.emit(FlowTokenEmitInput {
            run_ref: "run-kk".to_string(),
            node_ref: "node-y".to_string(),
            token_type: None,
            payload: None,
        }, &storage).await.unwrap();
        let token_id = match emit {
            FlowTokenEmitOutput::Ok { token_id, .. } => token_id,
        };

        handler.kill(FlowTokenKillInput {
            token_id: token_id.clone(),
            run_ref: "run-kk".to_string(),
            reason: Some("first kill".to_string()),
        }, &storage).await.unwrap();

        let result = handler.kill(FlowTokenKillInput {
            token_id: token_id.clone(),
            run_ref: "run-kk".to_string(),
            reason: Some("second kill".to_string()),
        }, &storage).await.unwrap();
        match result {
            FlowTokenKillOutput::AlreadyInactive { status, .. } => {
                assert_eq!(status, "killed");
            }
            _ => panic!("Expected AlreadyInactive"),
        }
    }

    #[tokio::test]
    async fn test_consume_killed_token_returns_already_consumed() {
        let storage = InMemoryStorage::new();
        let handler = FlowTokenHandlerImpl;

        let emit = handler.emit(FlowTokenEmitInput {
            run_ref: "run-ck".to_string(),
            node_ref: "node-z".to_string(),
            token_type: None,
            payload: None,
        }, &storage).await.unwrap();
        let token_id = match emit {
            FlowTokenEmitOutput::Ok { token_id, .. } => token_id,
        };

        handler.kill(FlowTokenKillInput {
            token_id: token_id.clone(),
            run_ref: "run-ck".to_string(),
            reason: None,
        }, &storage).await.unwrap();

        let result = handler.consume(FlowTokenConsumeInput {
            token_id: token_id.clone(),
            run_ref: "run-ck".to_string(),
        }, &storage).await.unwrap();
        match result {
            FlowTokenConsumeOutput::AlreadyConsumed { .. } => {}
            _ => panic!("Expected AlreadyConsumed for killed token"),
        }
    }

    #[tokio::test]
    async fn test_emit_with_payload_and_type() {
        let storage = InMemoryStorage::new();
        let handler = FlowTokenHandlerImpl;

        let result = handler.emit(FlowTokenEmitInput {
            run_ref: "run-typed".to_string(),
            node_ref: "gateway".to_string(),
            token_type: Some("signal".to_string()),
            payload: Some(json!({"signal": "interrupt", "priority": 1})),
        }, &storage).await.unwrap();
        match result {
            FlowTokenEmitOutput::Ok { token_id, node_ref, .. } => {
                assert!(token_id.starts_with("tok-"));
                assert_eq!(node_ref, "gateway");
            }
        }
    }

    #[tokio::test]
    async fn test_all_tokens_consumed_count_zero() {
        let storage = InMemoryStorage::new();
        let handler = FlowTokenHandlerImpl;

        let mut token_ids = Vec::new();
        for i in 0..4 {
            let result = handler.emit(FlowTokenEmitInput {
                run_ref: "run-zero".to_string(),
                node_ref: format!("node-{}", i),
                token_type: None,
                payload: None,
            }, &storage).await.unwrap();
            match result {
                FlowTokenEmitOutput::Ok { token_id, .. } => token_ids.push(token_id),
            }
        }

        for tid in &token_ids {
            handler.consume(FlowTokenConsumeInput {
                token_id: tid.clone(),
                run_ref: "run-zero".to_string(),
            }, &storage).await.unwrap();
        }

        let count = handler.count_active(FlowTokenCountActiveInput {
            run_ref: "run-zero".to_string(),
        }, &storage).await.unwrap();
        match count {
            FlowTokenCountActiveOutput::Ok { count } => assert_eq!(count, 0),
        }

        let list = handler.list_active(FlowTokenListActiveInput {
            run_ref: "run-zero".to_string(),
        }, &storage).await.unwrap();
        match list {
            FlowTokenListActiveOutput::Ok { tokens } => assert!(tokens.is_empty()),
        }
    }

    #[tokio::test]
    async fn test_count_active_for_nonexistent_run_is_zero() {
        let storage = InMemoryStorage::new();
        let handler = FlowTokenHandlerImpl;

        let count = handler.count_active(FlowTokenCountActiveInput {
            run_ref: "run-nonexistent".to_string(),
        }, &storage).await.unwrap();
        match count {
            FlowTokenCountActiveOutput::Ok { count } => assert_eq!(count, 0),
        }
    }

    #[tokio::test]
    async fn test_list_active_excludes_killed_and_consumed() {
        let storage = InMemoryStorage::new();
        let handler = FlowTokenHandlerImpl;

        let e1 = handler.emit(FlowTokenEmitInput {
            run_ref: "run-filter".to_string(),
            node_ref: "a".to_string(),
            token_type: None,
            payload: None,
        }, &storage).await.unwrap();
        let t1 = match e1 { FlowTokenEmitOutput::Ok { token_id, .. } => token_id };

        let e2 = handler.emit(FlowTokenEmitInput {
            run_ref: "run-filter".to_string(),
            node_ref: "b".to_string(),
            token_type: None,
            payload: None,
        }, &storage).await.unwrap();
        let t2 = match e2 { FlowTokenEmitOutput::Ok { token_id, .. } => token_id };

        handler.emit(FlowTokenEmitInput {
            run_ref: "run-filter".to_string(),
            node_ref: "c".to_string(),
            token_type: None,
            payload: None,
        }, &storage).await.unwrap();

        handler.consume(FlowTokenConsumeInput {
            token_id: t1,
            run_ref: "run-filter".to_string(),
        }, &storage).await.unwrap();

        handler.kill(FlowTokenKillInput {
            token_id: t2,
            run_ref: "run-filter".to_string(),
            reason: None,
        }, &storage).await.unwrap();

        let list = handler.list_active(FlowTokenListActiveInput {
            run_ref: "run-filter".to_string(),
        }, &storage).await.unwrap();
        match list {
            FlowTokenListActiveOutput::Ok { tokens } => {
                assert_eq!(tokens.len(), 1);
                assert_eq!(tokens[0]["node_ref"].as_str().unwrap(), "c");
            }
        }
    }

    #[tokio::test]
    async fn test_kill_nonexistent_token_returns_not_found() {
        let storage = InMemoryStorage::new();
        let handler = FlowTokenHandlerImpl;

        let result = handler.kill(FlowTokenKillInput {
            token_id: "tok-ghost".to_string(),
            run_ref: "run-x".to_string(),
            reason: None,
        }, &storage).await.unwrap();
        match result {
            FlowTokenKillOutput::NotFound { .. } => {}
            _ => panic!("Expected NotFound"),
        }
    }
}
