// Business logic tests for Checkpoint concept.
// Validates capture/restore integrity, find_latest behavior,
// pruning semantics, and multi-checkpoint scenarios.

#[cfg(test)]
mod tests {
    use super::super::handler::CheckpointHandler;
    use super::super::r#impl::CheckpointHandlerImpl;
    use super::super::types::*;
    use crate::storage::InMemoryStorage;
    use serde_json::json;

    #[tokio::test]
    async fn test_restore_preserves_all_snapshot_fields() {
        let storage = InMemoryStorage::new();
        let handler = CheckpointHandlerImpl;

        let cap = handler.capture(CheckpointCaptureInput {
            run_ref: "run-full".to_string(),
            run_state: json!({"status": "running", "current_step": "validate"}),
            variables_snapshot: json!({"x": 42, "list": [1, 2, 3]}),
            token_snapshot: json!([{"id": "t1", "node": "start"}, {"id": "t2", "node": "gate"}]),
            event_cursor: 55,
            label: Some("pre-validation".to_string()),
        }, &storage).await.unwrap();
        let ckpt_id = match cap {
            CheckpointCaptureOutput::Ok { checkpoint_id, .. } => checkpoint_id,
        };

        let restore = handler.restore(CheckpointRestoreInput {
            checkpoint_id: ckpt_id.clone(),
        }, &storage).await.unwrap();
        match restore {
            CheckpointRestoreOutput::Ok {
                run_state, variables_snapshot, token_snapshot, event_cursor, ..
            } => {
                assert_eq!(run_state["status"], "running");
                assert_eq!(run_state["current_step"], "validate");
                assert_eq!(variables_snapshot["x"], 42);
                assert_eq!(variables_snapshot["list"], json!([1, 2, 3]));
                assert_eq!(token_snapshot.as_array().unwrap().len(), 2);
                assert_eq!(event_cursor, 55);
            }
            _ => panic!("Expected Ok"),
        }
    }

    #[tokio::test]
    async fn test_multiple_checkpoints_independent() {
        let storage = InMemoryStorage::new();
        let handler = CheckpointHandlerImpl;

        let cap1 = handler.capture(CheckpointCaptureInput {
            run_ref: "run-multi".to_string(),
            run_state: json!({"v": 1}),
            variables_snapshot: json!({"a": 1}),
            token_snapshot: json!([]),
            event_cursor: 1,
            label: Some("first".to_string()),
        }, &storage).await.unwrap();
        let id1 = match cap1 {
            CheckpointCaptureOutput::Ok { checkpoint_id, .. } => checkpoint_id,
        };

        let cap2 = handler.capture(CheckpointCaptureInput {
            run_ref: "run-multi".to_string(),
            run_state: json!({"v": 2}),
            variables_snapshot: json!({"a": 2}),
            token_snapshot: json!([{"id": "t1"}]),
            event_cursor: 10,
            label: Some("second".to_string()),
        }, &storage).await.unwrap();
        let id2 = match cap2 {
            CheckpointCaptureOutput::Ok { checkpoint_id, .. } => checkpoint_id,
        };

        // Restore first checkpoint
        let r1 = handler.restore(CheckpointRestoreInput {
            checkpoint_id: id1.clone(),
        }, &storage).await.unwrap();
        match r1 {
            CheckpointRestoreOutput::Ok { run_state, event_cursor, .. } => {
                assert_eq!(run_state["v"], 1);
                assert_eq!(event_cursor, 1);
            }
            _ => panic!("Expected Ok"),
        }

        // Restore second checkpoint
        let r2 = handler.restore(CheckpointRestoreInput {
            checkpoint_id: id2.clone(),
        }, &storage).await.unwrap();
        match r2 {
            CheckpointRestoreOutput::Ok { run_state, event_cursor, .. } => {
                assert_eq!(run_state["v"], 2);
                assert_eq!(event_cursor, 10);
            }
            _ => panic!("Expected Ok"),
        }
    }

    #[tokio::test]
    async fn test_find_latest_returns_most_recent() {
        let storage = InMemoryStorage::new();
        let handler = CheckpointHandlerImpl;

        // Create checkpoints sequentially to ensure timestamp ordering
        handler.capture(CheckpointCaptureInput {
            run_ref: "run-latest".to_string(),
            run_state: json!({"v": 1}),
            variables_snapshot: json!({}),
            token_snapshot: json!([]),
            event_cursor: 1,
            label: Some("early".to_string()),
        }, &storage).await.unwrap();

        let cap2 = handler.capture(CheckpointCaptureInput {
            run_ref: "run-latest".to_string(),
            run_state: json!({"v": 2}),
            variables_snapshot: json!({}),
            token_snapshot: json!([]),
            event_cursor: 5,
            label: Some("late".to_string()),
        }, &storage).await.unwrap();
        let latest_id = match cap2 {
            CheckpointCaptureOutput::Ok { checkpoint_id, .. } => checkpoint_id,
        };

        let result = handler.find_latest(CheckpointFindLatestInput {
            run_ref: "run-latest".to_string(),
        }, &storage).await.unwrap();
        match result {
            CheckpointFindLatestOutput::Ok { checkpoint_id, .. } => {
                assert_eq!(checkpoint_id, latest_id);
            }
            _ => panic!("Expected Ok"),
        }
    }

    #[tokio::test]
    async fn test_prune_keeps_specified_count() {
        let storage = InMemoryStorage::new();
        let handler = CheckpointHandlerImpl;

        for i in 0..5 {
            handler.capture(CheckpointCaptureInput {
                run_ref: "run-prune".to_string(),
                run_state: json!({"v": i}),
                variables_snapshot: json!({}),
                token_snapshot: json!([]),
                event_cursor: i as i64,
                label: Some(format!("ckpt-{}", i)),
            }, &storage).await.unwrap();
        }

        let result = handler.prune(CheckpointPruneInput {
            run_ref: "run-prune".to_string(),
            keep_count: 2,
        }, &storage).await.unwrap();
        match result {
            CheckpointPruneOutput::Ok { pruned } => {
                assert_eq!(pruned, 3);
            }
        }
    }

    #[tokio::test]
    async fn test_prune_when_count_at_or_below_limit() {
        let storage = InMemoryStorage::new();
        let handler = CheckpointHandlerImpl;

        handler.capture(CheckpointCaptureInput {
            run_ref: "run-noprune".to_string(),
            run_state: json!({}),
            variables_snapshot: json!({}),
            token_snapshot: json!([]),
            event_cursor: 0,
            label: None,
        }, &storage).await.unwrap();

        let result = handler.prune(CheckpointPruneInput {
            run_ref: "run-noprune".to_string(),
            keep_count: 5,
        }, &storage).await.unwrap();
        match result {
            CheckpointPruneOutput::Ok { pruned } => {
                assert_eq!(pruned, 0);
            }
        }
    }

    #[tokio::test]
    async fn test_find_latest_for_different_runs_independent() {
        let storage = InMemoryStorage::new();
        let handler = CheckpointHandlerImpl;

        handler.capture(CheckpointCaptureInput {
            run_ref: "run-a".to_string(),
            run_state: json!({"run": "a"}),
            variables_snapshot: json!({}),
            token_snapshot: json!([]),
            event_cursor: 1,
            label: None,
        }, &storage).await.unwrap();

        handler.capture(CheckpointCaptureInput {
            run_ref: "run-b".to_string(),
            run_state: json!({"run": "b"}),
            variables_snapshot: json!({}),
            token_snapshot: json!([]),
            event_cursor: 99,
            label: None,
        }, &storage).await.unwrap();

        let result_a = handler.find_latest(CheckpointFindLatestInput {
            run_ref: "run-a".to_string(),
        }, &storage).await.unwrap();
        match result_a {
            CheckpointFindLatestOutput::Ok { run_ref, .. } => assert_eq!(run_ref, "run-a"),
            _ => panic!("Expected Ok"),
        }

        let result_b = handler.find_latest(CheckpointFindLatestInput {
            run_ref: "run-b".to_string(),
        }, &storage).await.unwrap();
        match result_b {
            CheckpointFindLatestOutput::Ok { run_ref, .. } => assert_eq!(run_ref, "run-b"),
            _ => panic!("Expected Ok"),
        }
    }

    #[tokio::test]
    async fn test_capture_without_label() {
        let storage = InMemoryStorage::new();
        let handler = CheckpointHandlerImpl;

        let result = handler.capture(CheckpointCaptureInput {
            run_ref: "run-nolabel".to_string(),
            run_state: json!({"step": "x"}),
            variables_snapshot: json!({}),
            token_snapshot: json!([]),
            event_cursor: 0,
            label: None,
        }, &storage).await.unwrap();
        match result {
            CheckpointCaptureOutput::Ok { checkpoint_id, timestamp } => {
                assert!(checkpoint_id.starts_with("ckpt-"));
                assert!(!timestamp.is_empty());
            }
        }
    }

    #[tokio::test]
    async fn test_prune_empty_run_returns_zero() {
        let storage = InMemoryStorage::new();
        let handler = CheckpointHandlerImpl;

        let result = handler.prune(CheckpointPruneInput {
            run_ref: "run-empty".to_string(),
            keep_count: 1,
        }, &storage).await.unwrap();
        match result {
            CheckpointPruneOutput::Ok { pruned } => assert_eq!(pruned, 0),
        }
    }
}
