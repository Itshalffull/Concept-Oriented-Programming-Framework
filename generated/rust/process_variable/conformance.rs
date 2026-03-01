// generated: process_variable/conformance.rs
// Conformance tests for ProcessVariable concept invariants.

#[cfg(test)]
mod tests {
    use super::super::handler::ProcessVariableHandler;
    use super::super::r#impl::ProcessVariableHandlerImpl;
    use super::super::types::*;
    use crate::storage::InMemoryStorage;
    use serde_json::json;

    fn create_test_handler() -> ProcessVariableHandlerImpl {
        ProcessVariableHandlerImpl
    }

    #[tokio::test]
    async fn process_variable_invariant_set_then_get() {
        // Invariant: after set, get returns the same value
        let storage = InMemoryStorage::new();
        let handler = create_test_handler();

        handler.set(
            ProcessVariableSetInput {
                run_ref: "run-inv-001".to_string(),
                name: "key1".to_string(),
                value: json!({ "data": "hello" }),
            },
            &storage,
        ).await.unwrap();

        let result = handler.get(
            ProcessVariableGetInput {
                run_ref: "run-inv-001".to_string(),
                name: "key1".to_string(),
            },
            &storage,
        ).await.unwrap();

        match result {
            ProcessVariableGetOutput::Ok { value, .. } => {
                assert_eq!(value, json!({ "data": "hello" }));
            }
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn process_variable_invariant_delete_then_get_not_found() {
        // Invariant: after delete, get returns NotFound
        let storage = InMemoryStorage::new();
        let handler = create_test_handler();

        handler.set(
            ProcessVariableSetInput {
                run_ref: "run-inv-002".to_string(),
                name: "to_remove".to_string(),
                value: json!(true),
            },
            &storage,
        ).await.unwrap();

        handler.delete(
            ProcessVariableDeleteInput {
                run_ref: "run-inv-002".to_string(),
                name: "to_remove".to_string(),
            },
            &storage,
        ).await.unwrap();

        let result = handler.get(
            ProcessVariableGetInput {
                run_ref: "run-inv-002".to_string(),
                name: "to_remove".to_string(),
            },
            &storage,
        ).await.unwrap();

        match result {
            ProcessVariableGetOutput::NotFound { .. } => {}
            _ => panic!("Expected NotFound after delete"),
        }
    }

    #[tokio::test]
    async fn process_variable_invariant_merge_preserves_existing_keys() {
        // Invariant: merge preserves keys not present in the overlay
        let storage = InMemoryStorage::new();
        let handler = create_test_handler();

        handler.set(
            ProcessVariableSetInput {
                run_ref: "run-inv-003".to_string(),
                name: "settings".to_string(),
                value: json!({ "a": 1, "b": 2 }),
            },
            &storage,
        ).await.unwrap();

        let result = handler.merge(
            ProcessVariableMergeInput {
                run_ref: "run-inv-003".to_string(),
                name: "settings".to_string(),
                value: json!({ "c": 3 }),
            },
            &storage,
        ).await.unwrap();

        match result {
            ProcessVariableMergeOutput::Ok { merged, .. } => {
                assert_eq!(merged["a"], json!(1));
                assert_eq!(merged["b"], json!(2));
                assert_eq!(merged["c"], json!(3));
            }
        }
    }

    #[tokio::test]
    async fn process_variable_invariant_snapshot_reflects_current_state() {
        // Invariant: snapshot captures all current variables
        let storage = InMemoryStorage::new();
        let handler = create_test_handler();

        handler.set(
            ProcessVariableSetInput {
                run_ref: "run-inv-004".to_string(),
                name: "alpha".to_string(),
                value: json!("a"),
            },
            &storage,
        ).await.unwrap();

        handler.set(
            ProcessVariableSetInput {
                run_ref: "run-inv-004".to_string(),
                name: "beta".to_string(),
                value: json!("b"),
            },
            &storage,
        ).await.unwrap();

        let result = handler.snapshot(
            ProcessVariableSnapshotInput {
                run_ref: "run-inv-004".to_string(),
            },
            &storage,
        ).await.unwrap();

        match result {
            ProcessVariableSnapshotOutput::Ok { snapshot_id, variables } => {
                assert!(snapshot_id.starts_with("snap-"));
                assert_eq!(variables["alpha"], json!("a"));
                assert_eq!(variables["beta"], json!("b"));
            }
        }
    }
}
