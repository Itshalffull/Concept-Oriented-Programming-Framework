// generated: verification_run/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::VerificationRunHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn verification_run_invariant_1() {
        // invariant 1: after start, complete behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let r = "u-test-invariant-001".to_string();
        let res = "u-test-invariant-002".to_string();
        let usage = "u-test-invariant-003".to_string();

        // --- AFTER clause ---
        // start(target_symbol: "clef/concept/Password", properties: ["p1", "p2"], solver: "z3", timeout_ms: 10000) -> ok(run: r)
        let step1 = handler.start(
            StartInput { target_symbol: "clef/concept/Password".to_string(), properties: todo!(/* list: ["p1".to_string(), "p2".to_string()] */), solver: "z3".to_string(), timeout_ms: 10000 },
            &storage,
        ).await.unwrap();
        match step1 {
            StartOutput::Ok { run, .. } => {
                assert_eq!(run, r.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // complete(run: r, results: res, resource_usage: usage) -> ok(run: r, proved: 2, refuted: 0, unknown: 0)
        let step2 = handler.complete(
            CompleteInput { run: r.clone(), results: res.clone(), resource_usage: usage.clone() },
            &storage,
        ).await.unwrap();
        match step2 {
            CompleteOutput::Ok { run, proved, refuted, unknown, .. } => {
                assert_eq!(run, r.clone());
                assert_eq!(proved, 2);
                assert_eq!(refuted, 0);
                assert_eq!(unknown, 0);
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}