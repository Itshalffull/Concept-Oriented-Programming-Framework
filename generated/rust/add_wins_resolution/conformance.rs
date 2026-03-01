// generated: add_wins_resolution/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::AddWinsResolutionHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn add_wins_resolution_invariant_1() {
        // invariant 1: after attemptResolve, attemptResolve behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let a = "u-test-invariant-001".to_string();
        let b = "u-test-invariant-002".to_string();
        let r = "u-test-invariant-003".to_string();

        // --- AFTER clause ---
        // attemptResolve(base: _, v1: a, v2: b, context: _) -> resolved(result: r)
        let step1 = handler.attempt_resolve(
            AttemptResolveInput { base: .clone(), v1: a.clone(), v2: b.clone(), context: .clone() },
            &storage,
        ).await.unwrap();
        match step1 {
            AttemptResolveOutput::Resolved { result, .. } => {
                assert_eq!(result, r.clone());
            },
            other => panic!("Expected Resolved, got {:?}", other),
        }

        // --- THEN clause ---
        // attemptResolve(base: _, v1: b, v2: a, context: _) -> resolved(result: r)
        let step2 = handler.attempt_resolve(
            AttemptResolveInput { base: .clone(), v1: b.clone(), v2: a.clone(), context: .clone() },
            &storage,
        ).await.unwrap();
        match step2 {
            AttemptResolveOutput::Resolved { result, .. } => {
                assert_eq!(result, r.clone());
            },
            other => panic!("Expected Resolved, got {:?}", other),
        }
    }

}
