// generated: lattice_merge/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::LatticeMergeHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn lattice_merge_invariant_1() {
        // invariant 1: after execute, execute behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let b = "u-test-invariant-001".to_string();
        let o = "u-test-invariant-002".to_string();
        let t = "u-test-invariant-003".to_string();
        let r = "u-test-invariant-004".to_string();

        // --- AFTER clause ---
        // execute(base: b, ours: o, theirs: t) -> clean(result: r)
        let step1 = handler.execute(
            ExecuteInput { base: b.clone(), ours: o.clone(), theirs: t.clone() },
            &storage,
        ).await.unwrap();
        match step1 {
            ExecuteOutput::Clean { result, .. } => {
                assert_eq!(result, r.clone());
            },
            other => panic!("Expected Clean, got {:?}", other),
        }

        // --- THEN clause ---
        // execute(base: b, ours: t, theirs: o) -> clean(result: r)
        let step2 = handler.execute(
            ExecuteInput { base: b.clone(), ours: t.clone(), theirs: o.clone() },
            &storage,
        ).await.unwrap();
        match step2 {
            ExecuteOutput::Clean { result, .. } => {
                assert_eq!(result, r.clone());
            },
            other => panic!("Expected Clean, got {:?}", other),
        }
    }

}
