// generated: merge/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::MergeHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn merge_invariant_1() {
        // invariant 1: after merge, finalize behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let b = "u-test-invariant-001".to_string();
        let o = "u-test-invariant-002".to_string();
        let t = "u-test-invariant-003".to_string();
        let r = "u-test-invariant-004".to_string();

        // --- AFTER clause ---
        // merge(base: b, ours: o, theirs: t, strategy: _) -> clean(result: r)
        let step1 = handler.merge(
            MergeInput { base: b.clone(), ours: o.clone(), theirs: t.clone(), strategy: .clone() },
            &storage,
        ).await.unwrap();
        match step1 {
            MergeOutput::Clean { result, .. } => {
                assert_eq!(result, r.clone());
            },
            other => panic!("Expected Clean, got {:?}", other),
        }

        // --- THEN clause ---
        // finalize(mergeId: _) -> ok(result: r)
        let step2 = handler.finalize(
            FinalizeInput { merge_id: .clone() },
            &storage,
        ).await.unwrap();
        match step2 {
            FinalizeOutput::Ok { result, .. } => {
                assert_eq!(result, r.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
