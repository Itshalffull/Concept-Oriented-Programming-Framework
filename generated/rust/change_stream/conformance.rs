// generated: change_stream/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::ChangeStreamHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn change_stream_invariant_1() {
        // invariant 1: after append, append behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let n1 = "u-test-invariant-001".to_string();
        let e1 = "u-test-invariant-002".to_string();
        let n2 = "u-test-invariant-003".to_string();
        let e2 = "u-test-invariant-004".to_string();

        // --- AFTER clause ---
        // append(type: "insert", before: _, after: _, source: "db") -> ok(offset: n1, eventId: e1)
        let step1 = handler.append(
            AppendInput { type: "insert".to_string(), before: .clone(), after: .clone(), source: "db".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            AppendOutput::Ok { offset, event_id, .. } => {
                assert_eq!(offset, n1.clone());
                assert_eq!(event_id, e1.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // append(type: "update", before: _, after: _, source: "db") -> ok(offset: n2, eventId: e2)
        let step2 = handler.append(
            AppendInput { type: "update".to_string(), before: .clone(), after: .clone(), source: "db".to_string() },
            &storage,
        ).await.unwrap();
        match step2 {
            AppendOutput::Ok { offset, event_id, .. } => {
                assert_eq!(offset, n2.clone());
                assert_eq!(event_id, e2.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

    #[tokio::test]
    async fn change_stream_invariant_2() {
        // invariant 2: after append, replay behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let t = "u-test-invariant-001".to_string();
        let b = "u-test-invariant-002".to_string();
        let a = "u-test-invariant-003".to_string();
        let s = "u-test-invariant-004".to_string();
        let n = "u-test-invariant-005".to_string();
        let e = "u-test-invariant-006".to_string();
        let evts = "u-test-invariant-007".to_string();

        // --- AFTER clause ---
        // append(type: t, before: b, after: a, source: s) -> ok(offset: n, eventId: e)
        let step1 = handler.append(
            AppendInput { type: t.clone(), before: b.clone(), after: a.clone(), source: s.clone() },
            &storage,
        ).await.unwrap();
        match step1 {
            AppendOutput::Ok { offset, event_id, .. } => {
                assert_eq!(offset, n.clone());
                assert_eq!(event_id, e.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // replay(from: n, to: n) -> ok(events: evts)
        let step2 = handler.replay(
            ReplayInput { from: n.clone(), to: n.clone() },
            &storage,
        ).await.unwrap();
        match step2 {
            ReplayOutput::Ok { events, .. } => {
                assert_eq!(events, evts.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
