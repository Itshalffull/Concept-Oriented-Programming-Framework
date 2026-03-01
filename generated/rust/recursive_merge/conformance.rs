// generated: recursive_merge/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::RecursiveMergeHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn recursive_merge_invariant_1() {
        // invariant 1: after execute, execute behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let b = "u-test-invariant-001".to_string();
        let t = "u-test-invariant-002".to_string();
        let o = "u-test-invariant-003".to_string();

        // --- AFTER clause ---
        // execute(base: b, ours: b, theirs: t) -> clean(result: t)
        let step1 = handler.execute(
            ExecuteInput { base: b.clone(), ours: b.clone(), theirs: t.clone() },
            &storage,
        ).await.unwrap();
        match step1 {
            ExecuteOutput::Clean { result, .. } => {
                assert_eq!(result, t.clone());
            },
            other => panic!("Expected Clean, got {:?}", other),
        }

        // --- THEN clause ---
        // execute(base: b, ours: o, theirs: b) -> clean(result: o)
        let step2 = handler.execute(
            ExecuteInput { base: b.clone(), ours: o.clone(), theirs: b.clone() },
            &storage,
        ).await.unwrap();
        match step2 {
            ExecuteOutput::Clean { result, .. } => {
                assert_eq!(result, o.clone());
            },
            other => panic!("Expected Clean, got {:?}", other),
        }
    }

}
