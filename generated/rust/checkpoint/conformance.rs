// generated: checkpoint/conformance.rs
// Conformance tests for Checkpoint concept invariants.

#[cfg(test)]
mod tests {
    use super::super::handler::CheckpointHandler;
    use super::super::r#impl::CheckpointHandlerImpl;
    use super::super::types::*;
    use crate::storage::InMemoryStorage;
    use serde_json::json;

    fn create_test_handler() -> CheckpointHandlerImpl {
        CheckpointHandlerImpl
    }

    #[tokio::test]
    async fn checkpoint_invariant_capture_restore_roundtrip() {
        // Invariant: capture then restore returns identical state
        let storage = InMemoryStorage::new();
        let handler = create_test_handler();

        let state = json!({ "status": "running", "step": "payment" });
        let vars = json!({ "amount": 5000, "currency": "USD" });
        let tokens = json!([{ "id": "t1", "pos": "step-3" }]);

        let cap = handler.capture(
            CheckpointCaptureInput {
                run_ref: "run-inv-001".to_string(),
                run_state: state.clone(),
                variables_snapshot: vars.clone(),
                token_snapshot: tokens.clone(),
                event_cursor: 42,
                label: Some("before_payment".to_string()),
            },
            &storage,
        ).await.unwrap();
        let ckpt_id = match cap {
            CheckpointCaptureOutput::Ok { checkpoint_id, .. } => checkpoint_id,
        };

        let restored = handler.restore(
            CheckpointRestoreInput { checkpoint_id: ckpt_id },
            &storage,
        ).await.unwrap();
        match restored {
            CheckpointRestoreOutput::Ok { run_state, variables_snapshot, token_snapshot, event_cursor, .. } => {
                assert_eq!(run_state, state);
                assert_eq!(variables_snapshot, vars);
                assert_eq!(token_snapshot, tokens);
                assert_eq!(event_cursor, 42);
            }
            _ => panic!("Expected Ok"),
        }
    }

    #[tokio::test]
    async fn checkpoint_invariant_find_latest_returns_most_recent() {
        // Invariant: find_latest returns the checkpoint with the latest timestamp
        let storage = InMemoryStorage::new();
        let handler = create_test_handler();

        handler.capture(
            CheckpointCaptureInput {
                run_ref: "run-inv-002".to_string(),
                run_state: json!({ "v": 1 }),
                variables_snapshot: json!({}),
                token_snapshot: json!([]),
                event_cursor: 1,
                label: Some("early".to_string()),
            },
            &storage,
        ).await.unwrap();

        let cap2 = handler.capture(
            CheckpointCaptureInput {
                run_ref: "run-inv-002".to_string(),
                run_state: json!({ "v": 2 }),
                variables_snapshot: json!({}),
                token_snapshot: json!([]),
                event_cursor: 10,
                label: Some("late".to_string()),
            },
            &storage,
        ).await.unwrap();
        let latest_id = match cap2 {
            CheckpointCaptureOutput::Ok { checkpoint_id, .. } => checkpoint_id,
        };

        let found = handler.find_latest(
            CheckpointFindLatestInput { run_ref: "run-inv-002".to_string() },
            &storage,
        ).await.unwrap();
        match found {
            CheckpointFindLatestOutput::Ok { checkpoint_id, .. } => {
                assert_eq!(checkpoint_id, latest_id);
            }
            _ => panic!("Expected Ok"),
        }
    }
}
