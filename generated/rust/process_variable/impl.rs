// ProcessVariable concept implementation
// Scoped key-value store for process execution state.
// Variables are namespaced per run, supporting set, get, merge,
// delete, list, and point-in-time snapshot operations.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::ProcessVariableHandler;
use serde_json::json;

pub struct ProcessVariableHandlerImpl;

fn var_key(run_ref: &str, name: &str) -> String {
    format!("{}::{}", run_ref, name)
}

fn merge_json(base: &serde_json::Value, overlay: &serde_json::Value) -> serde_json::Value {
    match (base, overlay) {
        (serde_json::Value::Object(b), serde_json::Value::Object(o)) => {
            let mut merged = b.clone();
            for (k, v) in o {
                let existing = merged.get(k).cloned().unwrap_or(serde_json::Value::Null);
                merged.insert(k.clone(), merge_json(&existing, v));
            }
            serde_json::Value::Object(merged)
        }
        (_, overlay) => overlay.clone(),
    }
}

#[async_trait]
impl ProcessVariableHandler for ProcessVariableHandlerImpl {
    async fn set(
        &self,
        input: ProcessVariableSetInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ProcessVariableSetOutput, Box<dyn std::error::Error>> {
        let key = var_key(&input.run_ref, &input.name);

        storage.put("process_variables", &key, json!({
            "run_ref": input.run_ref,
            "name": input.name,
            "value": input.value,
            "updated_at": chrono::Utc::now().to_rfc3339(),
        })).await?;

        Ok(ProcessVariableSetOutput::Ok {
            run_ref: input.run_ref,
            name: input.name,
        })
    }

    async fn get(
        &self,
        input: ProcessVariableGetInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ProcessVariableGetOutput, Box<dyn std::error::Error>> {
        let key = var_key(&input.run_ref, &input.name);
        let record = storage.get("process_variables", &key).await?;

        match record {
            Some(v) => Ok(ProcessVariableGetOutput::Ok {
                name: input.name,
                value: v["value"].clone(),
            }),
            None => Ok(ProcessVariableGetOutput::NotFound {
                run_ref: input.run_ref,
                name: input.name,
            }),
        }
    }

    async fn merge(
        &self,
        input: ProcessVariableMergeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ProcessVariableMergeOutput, Box<dyn std::error::Error>> {
        let key = var_key(&input.run_ref, &input.name);
        let existing = storage.get("process_variables", &key).await?;

        let base_value = existing
            .map(|v| v["value"].clone())
            .unwrap_or(json!({}));

        let merged = merge_json(&base_value, &input.value);

        storage.put("process_variables", &key, json!({
            "run_ref": input.run_ref,
            "name": input.name,
            "value": merged,
            "updated_at": chrono::Utc::now().to_rfc3339(),
        })).await?;

        Ok(ProcessVariableMergeOutput::Ok {
            name: input.name,
            merged,
        })
    }

    async fn delete(
        &self,
        input: ProcessVariableDeleteInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ProcessVariableDeleteOutput, Box<dyn std::error::Error>> {
        let key = var_key(&input.run_ref, &input.name);
        let existing = storage.get("process_variables", &key).await?;

        match existing {
            Some(_) => {
                storage.del("process_variables", &key).await?;
                Ok(ProcessVariableDeleteOutput::Ok {
                    run_ref: input.run_ref,
                    name: input.name,
                })
            }
            None => Ok(ProcessVariableDeleteOutput::NotFound {
                run_ref: input.run_ref,
                name: input.name,
            }),
        }
    }

    async fn list(
        &self,
        input: ProcessVariableListInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ProcessVariableListOutput, Box<dyn std::error::Error>> {
        let all_vars = storage.find("process_variables", Some(&json!({
            "run_ref": input.run_ref,
        }))).await?;

        Ok(ProcessVariableListOutput::Ok { variables: all_vars })
    }

    async fn snapshot(
        &self,
        input: ProcessVariableSnapshotInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ProcessVariableSnapshotOutput, Box<dyn std::error::Error>> {
        let all_vars = storage.find("process_variables", Some(&json!({
            "run_ref": input.run_ref,
        }))).await?;

        let snapshot_id = format!("snap-{}", uuid::Uuid::new_v4());
        let mut snapshot_map = serde_json::Map::new();

        for var in &all_vars {
            if let (Some(name), Some(value)) = (var["name"].as_str(), var.get("value")) {
                snapshot_map.insert(name.to_string(), value.clone());
            }
        }

        let variables = serde_json::Value::Object(snapshot_map);

        storage.put("process_variable_snapshots", &snapshot_id, json!({
            "snapshot_id": snapshot_id,
            "run_ref": input.run_ref,
            "variables": variables,
            "created_at": chrono::Utc::now().to_rfc3339(),
        })).await?;

        Ok(ProcessVariableSnapshotOutput::Ok {
            snapshot_id,
            variables,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_set_and_get_variable() {
        let storage = InMemoryStorage::new();
        let handler = ProcessVariableHandlerImpl;
        handler.set(
            ProcessVariableSetInput {
                run_ref: "run-001".to_string(),
                name: "counter".to_string(),
                value: json!(42),
            },
            &storage,
        ).await.unwrap();

        let result = handler.get(
            ProcessVariableGetInput {
                run_ref: "run-001".to_string(),
                name: "counter".to_string(),
            },
            &storage,
        ).await.unwrap();

        match result {
            ProcessVariableGetOutput::Ok { name, value } => {
                assert_eq!(name, "counter");
                assert_eq!(value, json!(42));
            }
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_get_nonexistent_returns_not_found() {
        let storage = InMemoryStorage::new();
        let handler = ProcessVariableHandlerImpl;

        let result = handler.get(
            ProcessVariableGetInput {
                run_ref: "run-002".to_string(),
                name: "missing".to_string(),
            },
            &storage,
        ).await.unwrap();

        match result {
            ProcessVariableGetOutput::NotFound { run_ref, name } => {
                assert_eq!(run_ref, "run-002");
                assert_eq!(name, "missing");
            }
            _ => panic!("Expected NotFound variant"),
        }
    }

    #[tokio::test]
    async fn test_merge_combines_objects() {
        let storage = InMemoryStorage::new();
        let handler = ProcessVariableHandlerImpl;

        handler.set(
            ProcessVariableSetInput {
                run_ref: "run-003".to_string(),
                name: "config".to_string(),
                value: json!({ "timeout": 30, "retries": 3 }),
            },
            &storage,
        ).await.unwrap();

        let result = handler.merge(
            ProcessVariableMergeInput {
                run_ref: "run-003".to_string(),
                name: "config".to_string(),
                value: json!({ "retries": 5, "verbose": true }),
            },
            &storage,
        ).await.unwrap();

        match result {
            ProcessVariableMergeOutput::Ok { merged, .. } => {
                assert_eq!(merged["timeout"], json!(30));
                assert_eq!(merged["retries"], json!(5));
                assert_eq!(merged["verbose"], json!(true));
            }
        }
    }

    #[tokio::test]
    async fn test_delete_existing_variable() {
        let storage = InMemoryStorage::new();
        let handler = ProcessVariableHandlerImpl;

        handler.set(
            ProcessVariableSetInput {
                run_ref: "run-004".to_string(),
                name: "temp".to_string(),
                value: json!("value"),
            },
            &storage,
        ).await.unwrap();

        let result = handler.delete(
            ProcessVariableDeleteInput {
                run_ref: "run-004".to_string(),
                name: "temp".to_string(),
            },
            &storage,
        ).await.unwrap();

        match result {
            ProcessVariableDeleteOutput::Ok { name, .. } => {
                assert_eq!(name, "temp");
            }
            _ => panic!("Expected Ok variant"),
        }

        // Verify deletion
        let get_result = handler.get(
            ProcessVariableGetInput {
                run_ref: "run-004".to_string(),
                name: "temp".to_string(),
            },
            &storage,
        ).await.unwrap();

        match get_result {
            ProcessVariableGetOutput::NotFound { .. } => {}
            _ => panic!("Expected NotFound after delete"),
        }
    }

    #[tokio::test]
    async fn test_delete_nonexistent_returns_not_found() {
        let storage = InMemoryStorage::new();
        let handler = ProcessVariableHandlerImpl;

        let result = handler.delete(
            ProcessVariableDeleteInput {
                run_ref: "run-005".to_string(),
                name: "missing".to_string(),
            },
            &storage,
        ).await.unwrap();

        match result {
            ProcessVariableDeleteOutput::NotFound { .. } => {}
            _ => panic!("Expected NotFound variant"),
        }
    }

    #[tokio::test]
    async fn test_list_returns_all_variables_for_run() {
        let storage = InMemoryStorage::new();
        let handler = ProcessVariableHandlerImpl;

        handler.set(
            ProcessVariableSetInput {
                run_ref: "run-006".to_string(),
                name: "a".to_string(),
                value: json!(1),
            },
            &storage,
        ).await.unwrap();

        handler.set(
            ProcessVariableSetInput {
                run_ref: "run-006".to_string(),
                name: "b".to_string(),
                value: json!(2),
            },
            &storage,
        ).await.unwrap();

        let result = handler.list(
            ProcessVariableListInput {
                run_ref: "run-006".to_string(),
            },
            &storage,
        ).await.unwrap();

        match result {
            ProcessVariableListOutput::Ok { variables } => {
                assert_eq!(variables.len(), 2);
            }
        }
    }

    #[tokio::test]
    async fn test_snapshot_captures_current_state() {
        let storage = InMemoryStorage::new();
        let handler = ProcessVariableHandlerImpl;

        handler.set(
            ProcessVariableSetInput {
                run_ref: "run-007".to_string(),
                name: "x".to_string(),
                value: json!(10),
            },
            &storage,
        ).await.unwrap();

        handler.set(
            ProcessVariableSetInput {
                run_ref: "run-007".to_string(),
                name: "y".to_string(),
                value: json!(20),
            },
            &storage,
        ).await.unwrap();

        let result = handler.snapshot(
            ProcessVariableSnapshotInput {
                run_ref: "run-007".to_string(),
            },
            &storage,
        ).await.unwrap();

        match result {
            ProcessVariableSnapshotOutput::Ok { snapshot_id, variables } => {
                assert!(snapshot_id.starts_with("snap-"));
                assert_eq!(variables["x"], json!(10));
                assert_eq!(variables["y"], json!(20));
            }
        }
    }
}
