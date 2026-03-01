// generated: causal_clock/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::CausalClockHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn causal_clock_invariant_1() {
        // invariant 1: after tick, tick, compare behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let r = "u-test-invariant-001".to_string();
        let t1 = "u-test-invariant-002".to_string();
        let t2 = "u-test-invariant-003".to_string();

        // --- AFTER clause ---
        // tick(replicaId: r) -> ok(timestamp: t1, clock: _)
        let step1 = handler.tick(
            TickInput { replica_id: r.clone() },
            &storage,
        ).await.unwrap();
        match step1 {
            TickOutput::Ok { timestamp, clock, .. } => {
                assert_eq!(timestamp, t1.clone());
                assert_eq!(clock, .clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // tick(replicaId: r) -> ok(timestamp: t2, clock: _)
        let step2 = handler.tick(
            TickInput { replica_id: r.clone() },
            &storage,
        ).await.unwrap();
        match step2 {
            TickOutput::Ok { timestamp, clock, .. } => {
                assert_eq!(timestamp, t2.clone());
                assert_eq!(clock, .clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
        // compare(a: t1, b: t2) -> before()
        let step3 = handler.compare(
            CompareInput { a: t1.clone(), b: t2.clone() },
            &storage,
        ).await.unwrap();
        assert!(matches!(step3, CompareOutput::Before));
    }

}
