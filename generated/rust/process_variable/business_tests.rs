// Business logic tests for ProcessVariable concept.
// Validates scoping, merge semantics, snapshot isolation,
// and variable lifecycle edge cases.

#[cfg(test)]
mod tests {
    use super::super::handler::ProcessVariableHandler;
    use super::super::r#impl::ProcessVariableHandlerImpl;
    use super::super::types::*;
    use crate::storage::InMemoryStorage;
    use serde_json::json;

    #[tokio::test]
    async fn test_variables_isolated_between_runs() {
        let storage = InMemoryStorage::new();
        let handler = ProcessVariableHandlerImpl;

        handler.set(ProcessVariableSetInput {
            run_ref: "run-a".to_string(),
            name: "counter".to_string(),
            value: json!(10),
        }, &storage).await.unwrap();

        handler.set(ProcessVariableSetInput {
            run_ref: "run-b".to_string(),
            name: "counter".to_string(),
            value: json!(99),
        }, &storage).await.unwrap();

        let get_a = handler.get(ProcessVariableGetInput {
            run_ref: "run-a".to_string(),
            name: "counter".to_string(),
        }, &storage).await.unwrap();
        match get_a {
            ProcessVariableGetOutput::Ok { value, .. } => assert_eq!(value, json!(10)),
            _ => panic!("Expected Ok"),
        }

        let get_b = handler.get(ProcessVariableGetInput {
            run_ref: "run-b".to_string(),
            name: "counter".to_string(),
        }, &storage).await.unwrap();
        match get_b {
            ProcessVariableGetOutput::Ok { value, .. } => assert_eq!(value, json!(99)),
            _ => panic!("Expected Ok"),
        }
    }

    #[tokio::test]
    async fn test_set_overwrites_existing_value() {
        let storage = InMemoryStorage::new();
        let handler = ProcessVariableHandlerImpl;

        handler.set(ProcessVariableSetInput {
            run_ref: "run-ow".to_string(),
            name: "status".to_string(),
            value: json!("pending"),
        }, &storage).await.unwrap();

        handler.set(ProcessVariableSetInput {
            run_ref: "run-ow".to_string(),
            name: "status".to_string(),
            value: json!("approved"),
        }, &storage).await.unwrap();

        let result = handler.get(ProcessVariableGetInput {
            run_ref: "run-ow".to_string(),
            name: "status".to_string(),
        }, &storage).await.unwrap();
        match result {
            ProcessVariableGetOutput::Ok { value, .. } => assert_eq!(value, json!("approved")),
            _ => panic!("Expected Ok"),
        }
    }

    #[tokio::test]
    async fn test_merge_deep_nested_objects() {
        let storage = InMemoryStorage::new();
        let handler = ProcessVariableHandlerImpl;

        handler.set(ProcessVariableSetInput {
            run_ref: "run-deep".to_string(),
            name: "config".to_string(),
            value: json!({
                "database": {"host": "localhost", "port": 5432},
                "cache": {"enabled": true}
            }),
        }, &storage).await.unwrap();

        let result = handler.merge(ProcessVariableMergeInput {
            run_ref: "run-deep".to_string(),
            name: "config".to_string(),
            value: json!({
                "database": {"port": 5433, "ssl": true},
                "logging": {"level": "debug"}
            }),
        }, &storage).await.unwrap();
        match result {
            ProcessVariableMergeOutput::Ok { merged, .. } => {
                assert_eq!(merged["database"]["host"], json!("localhost"));
                assert_eq!(merged["database"]["port"], json!(5433));
                assert_eq!(merged["database"]["ssl"], json!(true));
                assert_eq!(merged["cache"]["enabled"], json!(true));
                assert_eq!(merged["logging"]["level"], json!("debug"));
            }
        }
    }

    #[tokio::test]
    async fn test_merge_into_nonexistent_creates_variable() {
        let storage = InMemoryStorage::new();
        let handler = ProcessVariableHandlerImpl;

        let result = handler.merge(ProcessVariableMergeInput {
            run_ref: "run-new".to_string(),
            name: "fresh".to_string(),
            value: json!({"key": "value"}),
        }, &storage).await.unwrap();
        match result {
            ProcessVariableMergeOutput::Ok { merged, .. } => {
                assert_eq!(merged["key"], json!("value"));
            }
        }

        // Verify it is now stored
        let get = handler.get(ProcessVariableGetInput {
            run_ref: "run-new".to_string(),
            name: "fresh".to_string(),
        }, &storage).await.unwrap();
        match get {
            ProcessVariableGetOutput::Ok { value, .. } => {
                assert_eq!(value["key"], json!("value"));
            }
            _ => panic!("Expected Ok"),
        }
    }

    #[tokio::test]
    async fn test_delete_then_get_returns_not_found() {
        let storage = InMemoryStorage::new();
        let handler = ProcessVariableHandlerImpl;

        handler.set(ProcessVariableSetInput {
            run_ref: "run-del".to_string(),
            name: "temp".to_string(),
            value: json!("ephemeral"),
        }, &storage).await.unwrap();

        handler.delete(ProcessVariableDeleteInput {
            run_ref: "run-del".to_string(),
            name: "temp".to_string(),
        }, &storage).await.unwrap();

        let result = handler.get(ProcessVariableGetInput {
            run_ref: "run-del".to_string(),
            name: "temp".to_string(),
        }, &storage).await.unwrap();
        match result {
            ProcessVariableGetOutput::NotFound { .. } => {}
            _ => panic!("Expected NotFound after delete"),
        }
    }

    #[tokio::test]
    async fn test_list_empty_run_returns_empty() {
        let storage = InMemoryStorage::new();
        let handler = ProcessVariableHandlerImpl;

        let result = handler.list(ProcessVariableListInput {
            run_ref: "run-empty".to_string(),
        }, &storage).await.unwrap();
        match result {
            ProcessVariableListOutput::Ok { variables } => {
                assert!(variables.is_empty());
            }
        }
    }

    #[tokio::test]
    async fn test_snapshot_captures_point_in_time() {
        let storage = InMemoryStorage::new();
        let handler = ProcessVariableHandlerImpl;

        handler.set(ProcessVariableSetInput {
            run_ref: "run-snap".to_string(),
            name: "x".to_string(),
            value: json!(1),
        }, &storage).await.unwrap();

        handler.set(ProcessVariableSetInput {
            run_ref: "run-snap".to_string(),
            name: "y".to_string(),
            value: json!(2),
        }, &storage).await.unwrap();

        let snap1 = handler.snapshot(ProcessVariableSnapshotInput {
            run_ref: "run-snap".to_string(),
        }, &storage).await.unwrap();
        match &snap1 {
            ProcessVariableSnapshotOutput::Ok { variables, .. } => {
                assert_eq!(variables["x"], json!(1));
                assert_eq!(variables["y"], json!(2));
            }
        }

        // Modify variables after snapshot
        handler.set(ProcessVariableSetInput {
            run_ref: "run-snap".to_string(),
            name: "x".to_string(),
            value: json!(100),
        }, &storage).await.unwrap();

        handler.delete(ProcessVariableDeleteInput {
            run_ref: "run-snap".to_string(),
            name: "y".to_string(),
        }, &storage).await.unwrap();

        // Take second snapshot -- should reflect new state
        let snap2 = handler.snapshot(ProcessVariableSnapshotInput {
            run_ref: "run-snap".to_string(),
        }, &storage).await.unwrap();
        match snap2 {
            ProcessVariableSnapshotOutput::Ok { variables, .. } => {
                assert_eq!(variables["x"], json!(100));
                assert!(variables.get("y").is_none() || variables["y"].is_null());
            }
        }
    }

    #[tokio::test]
    async fn test_set_complex_value_types() {
        let storage = InMemoryStorage::new();
        let handler = ProcessVariableHandlerImpl;

        // Array value
        handler.set(ProcessVariableSetInput {
            run_ref: "run-types".to_string(),
            name: "list".to_string(),
            value: json!([1, "two", true, null]),
        }, &storage).await.unwrap();

        let result = handler.get(ProcessVariableGetInput {
            run_ref: "run-types".to_string(),
            name: "list".to_string(),
        }, &storage).await.unwrap();
        match result {
            ProcessVariableGetOutput::Ok { value, .. } => {
                assert!(value.is_array());
                assert_eq!(value.as_array().unwrap().len(), 4);
            }
            _ => panic!("Expected Ok"),
        }

        // Null value
        handler.set(ProcessVariableSetInput {
            run_ref: "run-types".to_string(),
            name: "nothing".to_string(),
            value: json!(null),
        }, &storage).await.unwrap();

        let result = handler.get(ProcessVariableGetInput {
            run_ref: "run-types".to_string(),
            name: "nothing".to_string(),
        }, &storage).await.unwrap();
        match result {
            ProcessVariableGetOutput::Ok { value, .. } => {
                assert!(value.is_null());
            }
            _ => panic!("Expected Ok"),
        }
    }

    #[tokio::test]
    async fn test_merge_scalar_replaces_entirely() {
        // Merging a non-object onto an existing value replaces it
        let storage = InMemoryStorage::new();
        let handler = ProcessVariableHandlerImpl;

        handler.set(ProcessVariableSetInput {
            run_ref: "run-scalar".to_string(),
            name: "val".to_string(),
            value: json!({"a": 1}),
        }, &storage).await.unwrap();

        let result = handler.merge(ProcessVariableMergeInput {
            run_ref: "run-scalar".to_string(),
            name: "val".to_string(),
            value: json!("replaced"),
        }, &storage).await.unwrap();
        match result {
            ProcessVariableMergeOutput::Ok { merged, .. } => {
                assert_eq!(merged, json!("replaced"));
            }
        }
    }
}
