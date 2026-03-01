// generated: process_event/conformance.rs
// Conformance tests for ProcessEvent concept invariants.

#[cfg(test)]
mod tests {
    use super::super::handler::ProcessEventHandler;
    use super::super::r#impl::ProcessEventHandlerImpl;
    use super::super::types::*;
    use crate::storage::InMemoryStorage;
    use serde_json::json;

    fn create_test_handler() -> ProcessEventHandlerImpl {
        ProcessEventHandlerImpl
    }

    #[tokio::test]
    async fn process_event_invariant_append_then_query() {
        // Invariant: after appending an event, querying the same run returns it
        let storage = InMemoryStorage::new();
        let handler = create_test_handler();

        let append_result = handler.append(
            ProcessEventAppendInput {
                run_ref: "run-inv-001".to_string(),
                event_type: "step_started".to_string(),
                payload: json!({ "step": "validate" }),
                source: Some("engine".to_string()),
            },
            &storage,
        ).await.unwrap();

        let event_id = match append_result {
            ProcessEventAppendOutput::Ok { event_id, sequence } => {
                assert_eq!(sequence, 1);
                event_id
            }
        };

        let query_result = handler.query(
            ProcessEventQueryInput {
                run_ref: "run-inv-001".to_string(),
                after_sequence: None,
                limit: None,
            },
            &storage,
        ).await.unwrap();

        match query_result {
            ProcessEventQueryOutput::Ok { events, cursor } => {
                assert!(!events.is_empty());
                assert_eq!(cursor, 1);
                assert_eq!(events[0]["event_id"].as_str().unwrap(), &event_id);
            }
        }
    }

    #[tokio::test]
    async fn process_event_invariant_cursor_monotonic() {
        // Invariant: cursor is monotonically increasing with each append
        let storage = InMemoryStorage::new();
        let handler = create_test_handler();

        for i in 1..=3 {
            let result = handler.append(
                ProcessEventAppendInput {
                    run_ref: "run-inv-002".to_string(),
                    event_type: "tick".to_string(),
                    payload: json!({ "i": i }),
                    source: None,
                },
                &storage,
            ).await.unwrap();

            match result {
                ProcessEventAppendOutput::Ok { sequence, .. } => {
                    assert_eq!(sequence, i);
                }
            }
        }

        let cursor_result = handler.get_cursor(
            ProcessEventGetCursorInput {
                run_ref: "run-inv-002".to_string(),
            },
            &storage,
        ).await.unwrap();

        match cursor_result {
            ProcessEventGetCursorOutput::Ok { cursor } => {
                assert_eq!(cursor, 3);
            }
        }
    }

    #[tokio::test]
    async fn process_event_invariant_type_filter_subset() {
        // Invariant: query_by_type results are a subset of query results
        let storage = InMemoryStorage::new();
        let handler = create_test_handler();

        handler.append(
            ProcessEventAppendInput {
                run_ref: "run-inv-003".to_string(),
                event_type: "alpha".to_string(),
                payload: json!({}),
                source: None,
            },
            &storage,
        ).await.unwrap();

        handler.append(
            ProcessEventAppendInput {
                run_ref: "run-inv-003".to_string(),
                event_type: "beta".to_string(),
                payload: json!({}),
                source: None,
            },
            &storage,
        ).await.unwrap();

        let all_result = handler.query(
            ProcessEventQueryInput {
                run_ref: "run-inv-003".to_string(),
                after_sequence: None,
                limit: None,
            },
            &storage,
        ).await.unwrap();

        let typed_result = handler.query_by_type(
            ProcessEventQueryByTypeInput {
                run_ref: "run-inv-003".to_string(),
                event_type: "alpha".to_string(),
            },
            &storage,
        ).await.unwrap();

        let all_count = match all_result {
            ProcessEventQueryOutput::Ok { events, .. } => events.len(),
        };

        let typed_count = match typed_result {
            ProcessEventQueryByTypeOutput::Ok { events } => events.len(),
        };

        assert!(typed_count <= all_count);
        assert_eq!(typed_count, 1);
    }
}
