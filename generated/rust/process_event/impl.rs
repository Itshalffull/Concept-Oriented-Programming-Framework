// ProcessEvent concept implementation
// Append-only, sequenced event log scoped to a process run.
// Provides ordered history of all state transitions and actions
// within a running process instance.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::ProcessEventHandler;
use serde_json::json;

pub struct ProcessEventHandlerImpl;

fn generate_event_id() -> String {
    format!("evt-{}", uuid::Uuid::new_v4())
}

#[async_trait]
impl ProcessEventHandler for ProcessEventHandlerImpl {
    async fn append(
        &self,
        input: ProcessEventAppendInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ProcessEventAppendOutput, Box<dyn std::error::Error>> {
        let event_id = generate_event_id();

        // Retrieve current cursor to determine next sequence number
        let cursor_key = format!("{}::cursor", input.run_ref);
        let current_cursor = storage.get("process_event_cursors", &cursor_key).await?;
        let sequence = current_cursor
            .and_then(|v| v["sequence"].as_i64())
            .unwrap_or(0) + 1;

        let timestamp = chrono::Utc::now().to_rfc3339();
        let event_key = format!("{}::{}", input.run_ref, event_id);

        storage.put("process_events", &event_key, json!({
            "event_id": event_id,
            "run_ref": input.run_ref,
            "event_type": input.event_type,
            "payload": input.payload,
            "source": input.source,
            "sequence": sequence,
            "timestamp": timestamp,
        })).await?;

        // Update the cursor
        storage.put("process_event_cursors", &cursor_key, json!({
            "run_ref": input.run_ref,
            "sequence": sequence,
        })).await?;

        Ok(ProcessEventAppendOutput::Ok { event_id, sequence })
    }

    async fn query(
        &self,
        input: ProcessEventQueryInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ProcessEventQueryOutput, Box<dyn std::error::Error>> {
        let all_events = storage.find("process_events", Some(&json!({
            "run_ref": input.run_ref,
        }))).await?;

        let after_seq = input.after_sequence.unwrap_or(0);
        let limit = input.limit.unwrap_or(100) as usize;

        let mut filtered: Vec<serde_json::Value> = all_events
            .into_iter()
            .filter(|e| e["sequence"].as_i64().unwrap_or(0) > after_seq)
            .collect();

        filtered.sort_by_key(|e| e["sequence"].as_i64().unwrap_or(0));
        filtered.truncate(limit);

        let cursor = filtered
            .last()
            .and_then(|e| e["sequence"].as_i64())
            .unwrap_or(after_seq);

        Ok(ProcessEventQueryOutput::Ok { events: filtered, cursor })
    }

    async fn query_by_type(
        &self,
        input: ProcessEventQueryByTypeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ProcessEventQueryByTypeOutput, Box<dyn std::error::Error>> {
        let all_events = storage.find("process_events", Some(&json!({
            "run_ref": input.run_ref,
        }))).await?;

        let filtered: Vec<serde_json::Value> = all_events
            .into_iter()
            .filter(|e| e["event_type"].as_str() == Some(&input.event_type))
            .collect();

        Ok(ProcessEventQueryByTypeOutput::Ok { events: filtered })
    }

    async fn get_cursor(
        &self,
        input: ProcessEventGetCursorInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ProcessEventGetCursorOutput, Box<dyn std::error::Error>> {
        let cursor_key = format!("{}::cursor", input.run_ref);
        let record = storage.get("process_event_cursors", &cursor_key).await?;
        let cursor = record
            .and_then(|v| v["sequence"].as_i64())
            .unwrap_or(0);

        Ok(ProcessEventGetCursorOutput::Ok { cursor })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_append_creates_event_with_sequence() {
        let storage = InMemoryStorage::new();
        let handler = ProcessEventHandlerImpl;
        let result = handler.append(
            ProcessEventAppendInput {
                run_ref: "run-001".to_string(),
                event_type: "step_started".to_string(),
                payload: json!({ "step": "validate" }),
                source: Some("engine".to_string()),
            },
            &storage,
        ).await.unwrap();
        match result {
            ProcessEventAppendOutput::Ok { event_id, sequence } => {
                assert!(event_id.starts_with("evt-"));
                assert_eq!(sequence, 1);
            }
        }
    }

    #[tokio::test]
    async fn test_append_increments_sequence() {
        let storage = InMemoryStorage::new();
        let handler = ProcessEventHandlerImpl;
        handler.append(
            ProcessEventAppendInput {
                run_ref: "run-002".to_string(),
                event_type: "started".to_string(),
                payload: json!({}),
                source: None,
            },
            &storage,
        ).await.unwrap();
        let result = handler.append(
            ProcessEventAppendInput {
                run_ref: "run-002".to_string(),
                event_type: "completed".to_string(),
                payload: json!({}),
                source: None,
            },
            &storage,
        ).await.unwrap();
        match result {
            ProcessEventAppendOutput::Ok { sequence, .. } => {
                assert_eq!(sequence, 2);
            }
        }
    }

    #[tokio::test]
    async fn test_query_returns_events_in_order() {
        let storage = InMemoryStorage::new();
        let handler = ProcessEventHandlerImpl;
        for i in 0..3 {
            handler.append(
                ProcessEventAppendInput {
                    run_ref: "run-003".to_string(),
                    event_type: format!("event_{}", i),
                    payload: json!({ "index": i }),
                    source: None,
                },
                &storage,
            ).await.unwrap();
        }
        let result = handler.query(
            ProcessEventQueryInput {
                run_ref: "run-003".to_string(),
                after_sequence: None,
                limit: None,
            },
            &storage,
        ).await.unwrap();
        match result {
            ProcessEventQueryOutput::Ok { events, cursor } => {
                assert_eq!(events.len(), 3);
                assert_eq!(cursor, 3);
            }
        }
    }

    #[tokio::test]
    async fn test_query_with_after_sequence_filters() {
        let storage = InMemoryStorage::new();
        let handler = ProcessEventHandlerImpl;
        for i in 0..5 {
            handler.append(
                ProcessEventAppendInput {
                    run_ref: "run-004".to_string(),
                    event_type: "tick".to_string(),
                    payload: json!({ "i": i }),
                    source: None,
                },
                &storage,
            ).await.unwrap();
        }
        let result = handler.query(
            ProcessEventQueryInput {
                run_ref: "run-004".to_string(),
                after_sequence: Some(3),
                limit: None,
            },
            &storage,
        ).await.unwrap();
        match result {
            ProcessEventQueryOutput::Ok { events, .. } => {
                assert_eq!(events.len(), 2);
            }
        }
    }

    #[tokio::test]
    async fn test_query_by_type_filters_correctly() {
        let storage = InMemoryStorage::new();
        let handler = ProcessEventHandlerImpl;
        handler.append(
            ProcessEventAppendInput {
                run_ref: "run-005".to_string(),
                event_type: "step_started".to_string(),
                payload: json!({}),
                source: None,
            },
            &storage,
        ).await.unwrap();
        handler.append(
            ProcessEventAppendInput {
                run_ref: "run-005".to_string(),
                event_type: "step_completed".to_string(),
                payload: json!({}),
                source: None,
            },
            &storage,
        ).await.unwrap();
        handler.append(
            ProcessEventAppendInput {
                run_ref: "run-005".to_string(),
                event_type: "step_started".to_string(),
                payload: json!({}),
                source: None,
            },
            &storage,
        ).await.unwrap();
        let result = handler.query_by_type(
            ProcessEventQueryByTypeInput {
                run_ref: "run-005".to_string(),
                event_type: "step_started".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ProcessEventQueryByTypeOutput::Ok { events } => {
                assert_eq!(events.len(), 2);
            }
        }
    }

    #[tokio::test]
    async fn test_get_cursor_returns_latest_sequence() {
        let storage = InMemoryStorage::new();
        let handler = ProcessEventHandlerImpl;
        handler.append(
            ProcessEventAppendInput {
                run_ref: "run-006".to_string(),
                event_type: "a".to_string(),
                payload: json!({}),
                source: None,
            },
            &storage,
        ).await.unwrap();
        handler.append(
            ProcessEventAppendInput {
                run_ref: "run-006".to_string(),
                event_type: "b".to_string(),
                payload: json!({}),
                source: None,
            },
            &storage,
        ).await.unwrap();
        let result = handler.get_cursor(
            ProcessEventGetCursorInput {
                run_ref: "run-006".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ProcessEventGetCursorOutput::Ok { cursor } => {
                assert_eq!(cursor, 2);
            }
        }
    }

    #[tokio::test]
    async fn test_get_cursor_returns_zero_for_empty_run() {
        let storage = InMemoryStorage::new();
        let handler = ProcessEventHandlerImpl;
        let result = handler.get_cursor(
            ProcessEventGetCursorInput {
                run_ref: "run-nonexistent".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ProcessEventGetCursorOutput::Ok { cursor } => {
                assert_eq!(cursor, 0);
            }
        }
    }
}
