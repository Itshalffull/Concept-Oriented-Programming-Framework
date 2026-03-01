// generated: diff/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::DiffHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn diff_invariant_1() {
        // invariant 1: after diff, patch behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let a = "u-test-invariant-001".to_string();
        let b = "u-test-invariant-002".to_string();
        let es = "u-test-invariant-003".to_string();

        // --- AFTER clause ---
        // diff(contentA: a, contentB: b, algorithm: _) -> diffed(editScript: es, distance: _)
        let step1 = handler.diff(
            DiffInput { content_a: a.clone(), content_b: b.clone(), algorithm: .clone() },
            &storage,
        ).await.unwrap();
        match step1 {
            DiffOutput::Diffed { edit_script, distance, .. } => {
                assert_eq!(edit_script, es.clone());
                assert_eq!(distance, .clone());
            },
            other => panic!("Expected Diffed, got {:?}", other),
        }

        // --- THEN clause ---
        // patch(content: a, editScript: es) -> ok(result: b)
        let step2 = handler.patch(
            PatchInput { content: a.clone(), edit_script: es.clone() },
            &storage,
        ).await.unwrap();
        match step2 {
            PatchOutput::Ok { result, .. } => {
                assert_eq!(result, b.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
