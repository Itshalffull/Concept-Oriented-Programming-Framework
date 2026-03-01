// generated: manual_resolution/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::ManualResolutionHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn manual_resolution_invariant_1() {
        // invariant 1: after attemptResolve, register behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        // --- AFTER clause ---
        // attemptResolve(base: _, v1: _, v2: _, context: _) -> cannotResolve(reason: _)
        let step1 = handler.attempt_resolve(
            AttemptResolveInput { base: .clone(), v1: .clone(), v2: .clone(), context: .clone() },
            &storage,
        ).await.unwrap();
        match step1 {
            AttemptResolveOutput::CannotResolve { reason, .. } => {
                assert_eq!(reason, .clone());
            },
            other => panic!("Expected CannotResolve, got {:?}", other),
        }

        // --- THEN clause ---
        // register() -> ok(name: "manual", category: "conflict-resolution", priority: 99)
        let step2 = handler.register(
            RegisterInput {  },
            &storage,
        ).await.unwrap();
        match step2 {
            RegisterOutput::Ok { name, category, priority, .. } => {
                assert_eq!(name, "manual".to_string());
                assert_eq!(category, "conflict-resolution".to_string());
                assert_eq!(priority, 99);
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
