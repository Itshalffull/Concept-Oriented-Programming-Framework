// Business logic tests for ProcessEvent concept.
// Validates append-only semantics, sequence numbering,
// cross-run isolation, query filtering, and cursor management.

#[cfg(test)]
mod tests {
    use super::super::handler::ProcessEventHandler;
    use super::super::r#impl::ProcessEventHandlerImpl;
    use super::super::types::*;
    use crate::storage::InMemoryStorage;
    use serde_json::json;

    #[tokio::test]
    async fn test_sequences_are_monotonically_increasing() {
        let storage = InMemoryStorage::new();
        let handler = ProcessEventHandlerImpl;

        let mut last_seq = 0i64;
        for i in 0..5 {
            let result = handler.append(ProcessEventAppendInput {
                run_ref: "run-mono".to_string(),
                event_type: format!("event_{}", i),
                payload: json!({"i": i}),
                source: None,
            }, &storage).await.unwrap();
            match result {
                ProcessEventAppendOutput::Ok { sequence, .. } => {
                    assert!(sequence > last_seq, "Sequence {} must be > {}", sequence, last_seq);
                    last_seq = sequence;
                }
            }
        }
        assert_eq!(last_seq, 5);
    }

    #[tokio::test]
    async fn test_events_isolated_between_runs() {
        let storage = InMemoryStorage::new();
        let handler = ProcessEventHandlerImpl;

        for i in 0..3 {
            handler.append(ProcessEventAppendInput {
                run_ref: "run-iso-a".to_string(),
                event_type: format!("ev_{}", i),
                payload: json!({}),
                source: None,
            }, &storage).await.unwrap();
        }

        handler.append(ProcessEventAppendInput {
            run_ref: "run-iso-b".to_string(),
            event_type: "ev_0".to_string(),
            payload: json!({}),
            source: None,
        }, &storage).await.unwrap();

        let query_a = handler.query(ProcessEventQueryInput {
            run_ref: "run-iso-a".to_string(),
            after_sequence: None,
            limit: None,
        }, &storage).await.unwrap();
        match query_a {
            ProcessEventQueryOutput::Ok { events, .. } => assert_eq!(events.len(), 3),
        }

        let query_b = handler.query(ProcessEventQueryInput {
            run_ref: "run-iso-b".to_string(),
            after_sequence: None,
            limit: None,
        }, &storage).await.unwrap();
        match query_b {
            ProcessEventQueryOutput::Ok { events, .. } => assert_eq!(events.len(), 1),
        }
    }

    #[tokio::test]
    async fn test_query_with_limit_truncates_results() {
        let storage = InMemoryStorage::new();
        let handler = ProcessEventHandlerImpl;

        for i in 0..10 {
            handler.append(ProcessEventAppendInput {
                run_ref: "run-limit".to_string(),
                event_type: format!("ev_{}", i),
                payload: json!({}),
                source: None,
            }, &storage).await.unwrap();
        }

        let result = handler.query(ProcessEventQueryInput {
            run_ref: "run-limit".to_string(),
            after_sequence: None,
            limit: Some(3),
        }, &storage).await.unwrap();
        match result {
            ProcessEventQueryOutput::Ok { events, cursor } => {
                assert_eq!(events.len(), 3);
                assert_eq!(cursor, 3);
            }
        }
    }

    #[tokio::test]
    async fn test_query_paginated_cursor_navigation() {
        let storage = InMemoryStorage::new();
        let handler = ProcessEventHandlerImpl;

        for i in 0..6 {
            handler.append(ProcessEventAppendInput {
                run_ref: "run-page".to_string(),
                event_type: format!("ev_{}", i),
                payload: json!({"i": i}),
                source: None,
            }, &storage).await.unwrap();
        }

        // Page 1: events 1-2
        let page1 = handler.query(ProcessEventQueryInput {
            run_ref: "run-page".to_string(),
            after_sequence: None,
            limit: Some(2),
        }, &storage).await.unwrap();
        let cursor1 = match page1 {
            ProcessEventQueryOutput::Ok { events, cursor } => {
                assert_eq!(events.len(), 2);
                cursor
            }
        };

        // Page 2: events 3-4
        let page2 = handler.query(ProcessEventQueryInput {
            run_ref: "run-page".to_string(),
            after_sequence: Some(cursor1),
            limit: Some(2),
        }, &storage).await.unwrap();
        let cursor2 = match page2 {
            ProcessEventQueryOutput::Ok { events, cursor } => {
                assert_eq!(events.len(), 2);
                cursor
            }
        };

        // Page 3: events 5-6
        let page3 = handler.query(ProcessEventQueryInput {
            run_ref: "run-page".to_string(),
            after_sequence: Some(cursor2),
            limit: Some(2),
        }, &storage).await.unwrap();
        match page3 {
            ProcessEventQueryOutput::Ok { events, cursor } => {
                assert_eq!(events.len(), 2);
                assert_eq!(cursor, 6);
            }
        }

        // Page 4: no more events
        let page4 = handler.query(ProcessEventQueryInput {
            run_ref: "run-page".to_string(),
            after_sequence: Some(6),
            limit: Some(2),
        }, &storage).await.unwrap();
        match page4 {
            ProcessEventQueryOutput::Ok { events, .. } => {
                assert!(events.is_empty());
            }
        }
    }

    #[tokio::test]
    async fn test_query_by_type_returns_only_matching() {
        let storage = InMemoryStorage::new();
        let handler = ProcessEventHandlerImpl;

        handler.append(ProcessEventAppendInput {
            run_ref: "run-typed".to_string(),
            event_type: "step.started".to_string(),
            payload: json!({"step": "a"}),
            source: None,
        }, &storage).await.unwrap();
        handler.append(ProcessEventAppendInput {
            run_ref: "run-typed".to_string(),
            event_type: "step.completed".to_string(),
            payload: json!({"step": "a"}),
            source: None,
        }, &storage).await.unwrap();
        handler.append(ProcessEventAppendInput {
            run_ref: "run-typed".to_string(),
            event_type: "step.started".to_string(),
            payload: json!({"step": "b"}),
            source: None,
        }, &storage).await.unwrap();
        handler.append(ProcessEventAppendInput {
            run_ref: "run-typed".to_string(),
            event_type: "error".to_string(),
            payload: json!({"msg": "oops"}),
            source: None,
        }, &storage).await.unwrap();

        let started = handler.query_by_type(ProcessEventQueryByTypeInput {
            run_ref: "run-typed".to_string(),
            event_type: "step.started".to_string(),
        }, &storage).await.unwrap();
        match started {
            ProcessEventQueryByTypeOutput::Ok { events } => assert_eq!(events.len(), 2),
        }

        let errors = handler.query_by_type(ProcessEventQueryByTypeInput {
            run_ref: "run-typed".to_string(),
            event_type: "error".to_string(),
        }, &storage).await.unwrap();
        match errors {
            ProcessEventQueryByTypeOutput::Ok { events } => assert_eq!(events.len(), 1),
        }
    }

    #[tokio::test]
    async fn test_cursor_for_nonexistent_run_is_zero() {
        let storage = InMemoryStorage::new();
        let handler = ProcessEventHandlerImpl;

        let result = handler.get_cursor(ProcessEventGetCursorInput {
            run_ref: "run-ghost".to_string(),
        }, &storage).await.unwrap();
        match result {
            ProcessEventGetCursorOutput::Ok { cursor } => assert_eq!(cursor, 0),
        }
    }

    #[tokio::test]
    async fn test_append_with_source_metadata() {
        let storage = InMemoryStorage::new();
        let handler = ProcessEventHandlerImpl;

        let result = handler.append(ProcessEventAppendInput {
            run_ref: "run-src".to_string(),
            event_type: "audit.access".to_string(),
            payload: json!({"resource": "secret-doc", "action": "read"}),
            source: Some("audit-service".to_string()),
        }, &storage).await.unwrap();
        match result {
            ProcessEventAppendOutput::Ok { event_id, sequence } => {
                assert!(event_id.starts_with("evt-"));
                assert_eq!(sequence, 1);
            }
        }
    }

    #[tokio::test]
    async fn test_query_empty_run_returns_empty_events() {
        let storage = InMemoryStorage::new();
        let handler = ProcessEventHandlerImpl;

        let result = handler.query(ProcessEventQueryInput {
            run_ref: "run-empty".to_string(),
            after_sequence: None,
            limit: None,
        }, &storage).await.unwrap();
        match result {
            ProcessEventQueryOutput::Ok { events, cursor } => {
                assert!(events.is_empty());
                assert_eq!(cursor, 0);
            }
        }
    }

    #[tokio::test]
    async fn test_query_by_type_nonexistent_type_returns_empty() {
        let storage = InMemoryStorage::new();
        let handler = ProcessEventHandlerImpl;

        handler.append(ProcessEventAppendInput {
            run_ref: "run-notype".to_string(),
            event_type: "step.started".to_string(),
            payload: json!({}),
            source: None,
        }, &storage).await.unwrap();

        let result = handler.query_by_type(ProcessEventQueryByTypeInput {
            run_ref: "run-notype".to_string(),
            event_type: "nonexistent.event".to_string(),
        }, &storage).await.unwrap();
        match result {
            ProcessEventQueryByTypeOutput::Ok { events } => assert!(events.is_empty()),
        }
    }
}
