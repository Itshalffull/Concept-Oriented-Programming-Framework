// generated: histogram_diff/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::HistogramDiffHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn histogram_diff_invariant_1() {
        // invariant 1: after compute, compute behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let a = "u-test-invariant-001".to_string();
        let b = "u-test-invariant-002".to_string();
        let es = "u-test-invariant-003".to_string();
        let d = "u-test-invariant-004".to_string();

        // --- AFTER clause ---
        // compute(contentA: a, contentB: a) -> ok(editScript: _, distance: 0)
        let step1 = handler.compute(
            ComputeInput { content_a: a.clone(), content_b: a.clone() },
            &storage,
        ).await.unwrap();
        match step1 {
            ComputeOutput::Ok { edit_script, distance, .. } => {
                assert_eq!(edit_script, .clone());
                assert_eq!(distance, 0);
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // compute(contentA: a, contentB: b) -> ok(editScript: es, distance: d)
        let step2 = handler.compute(
            ComputeInput { content_a: a.clone(), content_b: b.clone() },
            &storage,
        ).await.unwrap();
        match step2 {
            ComputeOutput::Ok { edit_script, distance, .. } => {
                assert_eq!(edit_script, es.clone());
                assert_eq!(distance, d.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
