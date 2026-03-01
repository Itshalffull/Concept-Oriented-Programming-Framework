// generated: conflict_resolution/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::ConflictResolutionHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn conflict_resolution_invariant_1() {
        // invariant 1: after detect, resolve behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        // --- AFTER clause ---
        // detect(base: _, version1: _, version2: _, context: _) -> noConflict()
        let step1 = handler.detect(
            DetectInput { base: .clone(), version1: .clone(), version2: .clone(), context: .clone() },
            &storage,
        ).await.unwrap();
        assert!(matches!(step1, DetectOutput::NoConflict));

        // --- THEN clause ---
        // resolve(conflictId: _, policyOverride: _) -> resolved(result: _)
        let step2 = handler.resolve(
            ResolveInput { conflict_id: .clone(), policy_override: .clone() },
            &storage,
        ).await.unwrap();
        match step2 {
            ResolveOutput::Resolved { result, .. } => {
                assert_eq!(result, .clone());
            },
            other => panic!("Expected Resolved, got {:?}", other),
        }
    }

}
