// Checkpoint concept implementation
// Captures and restores complete process state snapshots for recovery,
// time-travel debugging, and audit. Storage is delegated to providers.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::CheckpointHandler;
use serde_json::json;

pub struct CheckpointHandlerImpl;

fn generate_checkpoint_id() -> String {
    format!("ckpt-{}", uuid::Uuid::new_v4())
}

fn checkpoint_key(run_ref: &str, checkpoint_id: &str) -> String {
    format!("{}::{}", run_ref, checkpoint_id)
}

#[async_trait]
impl CheckpointHandler for CheckpointHandlerImpl {
    async fn capture(
        &self,
        input: CheckpointCaptureInput,
        storage: &dyn ConceptStorage,
    ) -> Result<CheckpointCaptureOutput, Box<dyn std::error::Error>> {
        let checkpoint_id = generate_checkpoint_id();
        let timestamp = chrono::Utc::now().to_rfc3339();
        let key = checkpoint_key(&input.run_ref, &checkpoint_id);

        storage.put("checkpoints", &key, json!({
            "checkpoint_id": checkpoint_id,
            "run_ref": input.run_ref,
            "run_state": input.run_state,
            "variables_snapshot": input.variables_snapshot,
            "token_snapshot": input.token_snapshot,
            "event_cursor": input.event_cursor,
            "label": input.label,
            "timestamp": timestamp,
        })).await?;

        Ok(CheckpointCaptureOutput::Ok {
            checkpoint_id,
            timestamp,
        })
    }

    async fn restore(
        &self,
        input: CheckpointRestoreInput,
        storage: &dyn ConceptStorage,
    ) -> Result<CheckpointRestoreOutput, Box<dyn std::error::Error>> {
        // Search across all checkpoints by checkpoint_id
        let all = storage.find("checkpoints", Some(&json!({
            "checkpoint_id": input.checkpoint_id,
        }))).await?;

        match all.into_iter().next() {
            None => Ok(CheckpointRestoreOutput::NotFound {
                checkpoint_id: input.checkpoint_id,
            }),
            Some(record) => Ok(CheckpointRestoreOutput::Ok {
                checkpoint_id: input.checkpoint_id,
                run_state: record["run_state"].clone(),
                variables_snapshot: record["variables_snapshot"].clone(),
                token_snapshot: record["token_snapshot"].clone(),
                event_cursor: record["event_cursor"].as_i64().unwrap_or(0),
            }),
        }
    }

    async fn find_latest(
        &self,
        input: CheckpointFindLatestInput,
        storage: &dyn ConceptStorage,
    ) -> Result<CheckpointFindLatestOutput, Box<dyn std::error::Error>> {
        let all = storage.find("checkpoints", Some(&json!({
            "run_ref": input.run_ref,
        }))).await?;

        if all.is_empty() {
            return Ok(CheckpointFindLatestOutput::None {
                run_ref: input.run_ref,
            });
        }

        // Find the one with the latest timestamp
        let latest = all.iter()
            .max_by_key(|c| c["timestamp"].as_str().unwrap_or("").to_string())
            .unwrap();

        Ok(CheckpointFindLatestOutput::Ok {
            checkpoint_id: latest["checkpoint_id"].as_str().unwrap_or("").to_string(),
            run_ref: input.run_ref,
            timestamp: latest["timestamp"].as_str().unwrap_or("").to_string(),
        })
    }

    async fn prune(
        &self,
        input: CheckpointPruneInput,
        storage: &dyn ConceptStorage,
    ) -> Result<CheckpointPruneOutput, Box<dyn std::error::Error>> {
        let all = storage.find("checkpoints", Some(&json!({
            "run_ref": input.run_ref,
        }))).await?;

        if all.len() as i64 <= input.keep_count {
            return Ok(CheckpointPruneOutput::Ok { pruned: 0 });
        }

        // Sort by timestamp descending, keep the most recent keep_count
        let mut sorted = all.clone();
        sorted.sort_by(|a, b| {
            let ta = a["timestamp"].as_str().unwrap_or("");
            let tb = b["timestamp"].as_str().unwrap_or("");
            tb.cmp(ta)
        });

        let to_remove = &sorted[input.keep_count as usize..];
        let pruned_count = to_remove.len() as i64;

        for item in to_remove {
            let ckpt_id = item["checkpoint_id"].as_str().unwrap_or("");
            let key = checkpoint_key(&input.run_ref, ckpt_id);
            storage.delete("checkpoints", &key).await?;
        }

        Ok(CheckpointPruneOutput::Ok { pruned: pruned_count })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_capture_creates_checkpoint() {
        let storage = InMemoryStorage::new();
        let handler = CheckpointHandlerImpl;
        let result = handler.capture(
            CheckpointCaptureInput {
                run_ref: "run-001".to_string(),
                run_state: json!({ "status": "running" }),
                variables_snapshot: json!({ "x": 42 }),
                token_snapshot: json!([]),
                event_cursor: 10,
                label: Some("before_payment".to_string()),
            },
            &storage,
        ).await.unwrap();
        match result {
            CheckpointCaptureOutput::Ok { checkpoint_id, .. } => {
                assert!(checkpoint_id.starts_with("ckpt-"));
            }
        }
    }

    #[tokio::test]
    async fn test_restore_checkpoint() {
        let storage = InMemoryStorage::new();
        let handler = CheckpointHandlerImpl;

        let cap = handler.capture(
            CheckpointCaptureInput {
                run_ref: "run-002".to_string(),
                run_state: json!({ "status": "suspended" }),
                variables_snapshot: json!({ "total": 100 }),
                token_snapshot: json!([{ "id": "t1" }]),
                event_cursor: 25,
                label: None,
            },
            &storage,
        ).await.unwrap();
        let ckpt_id = match cap {
            CheckpointCaptureOutput::Ok { checkpoint_id, .. } => checkpoint_id,
        };

        let result = handler.restore(
            CheckpointRestoreInput { checkpoint_id: ckpt_id },
            &storage,
        ).await.unwrap();
        match result {
            CheckpointRestoreOutput::Ok { run_state, event_cursor, .. } => {
                assert_eq!(run_state["status"], "suspended");
                assert_eq!(event_cursor, 25);
            }
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_restore_not_found() {
        let storage = InMemoryStorage::new();
        let handler = CheckpointHandlerImpl;
        let result = handler.restore(
            CheckpointRestoreInput { checkpoint_id: "ckpt-nonexistent".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            CheckpointRestoreOutput::NotFound { .. } => {}
            _ => panic!("Expected NotFound variant"),
        }
    }

    #[tokio::test]
    async fn test_find_latest() {
        let storage = InMemoryStorage::new();
        let handler = CheckpointHandlerImpl;

        handler.capture(
            CheckpointCaptureInput {
                run_ref: "run-003".to_string(),
                run_state: json!({ "v": 1 }),
                variables_snapshot: json!({}),
                token_snapshot: json!([]),
                event_cursor: 1,
                label: Some("first".to_string()),
            },
            &storage,
        ).await.unwrap();

        handler.capture(
            CheckpointCaptureInput {
                run_ref: "run-003".to_string(),
                run_state: json!({ "v": 2 }),
                variables_snapshot: json!({}),
                token_snapshot: json!([]),
                event_cursor: 5,
                label: Some("second".to_string()),
            },
            &storage,
        ).await.unwrap();

        let result = handler.find_latest(
            CheckpointFindLatestInput { run_ref: "run-003".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            CheckpointFindLatestOutput::Ok { checkpoint_id, .. } => {
                assert!(checkpoint_id.starts_with("ckpt-"));
            }
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_find_latest_none() {
        let storage = InMemoryStorage::new();
        let handler = CheckpointHandlerImpl;
        let result = handler.find_latest(
            CheckpointFindLatestInput { run_ref: "run-empty".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            CheckpointFindLatestOutput::None { .. } => {}
            _ => panic!("Expected None variant"),
        }
    }
}
