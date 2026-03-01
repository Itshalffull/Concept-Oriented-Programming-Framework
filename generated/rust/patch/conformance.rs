// generated: patch/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::PatchHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn patch_invariant_1() {
        // invariant 1: after create, apply behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let b = "u-test-invariant-001".to_string();
        let t = "u-test-invariant-002".to_string();
        let e = "u-test-invariant-003".to_string();
        let p = "u-test-invariant-004".to_string();

        // --- AFTER clause ---
        // create(base: b, target: t, effect: e) -> ok(patchId: p)
        let step1 = handler.create(
            CreateInput { base: b.clone(), target: t.clone(), effect: e.clone() },
            &storage,
        ).await.unwrap();
        match step1 {
            CreateOutput::Ok { patch_id, .. } => {
                assert_eq!(patch_id, p.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // apply(patchId: p, content: b) -> ok(result: t)
        let step2 = handler.apply(
            ApplyInput { patch_id: p.clone(), content: b.clone() },
            &storage,
        ).await.unwrap();
        match step2 {
            ApplyOutput::Ok { result, .. } => {
                assert_eq!(result, t.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

    #[tokio::test]
    async fn patch_invariant_2() {
        // invariant 2: after invert, apply, apply behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let p = "u-test-invariant-001".to_string();
        let inv = "u-test-invariant-002".to_string();
        let b = "u-test-invariant-003".to_string();
        let t = "u-test-invariant-004".to_string();

        // --- AFTER clause ---
        // invert(patchId: p) -> ok(inversePatchId: inv)
        let step1 = handler.invert(
            InvertInput { patch_id: p.clone() },
            &storage,
        ).await.unwrap();
        match step1 {
            InvertOutput::Ok { inverse_patch_id, .. } => {
                assert_eq!(inverse_patch_id, inv.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // apply(patchId: p, content: b) -> ok(result: t)
        let step2 = handler.apply(
            ApplyInput { patch_id: p.clone(), content: b.clone() },
            &storage,
        ).await.unwrap();
        match step2 {
            ApplyOutput::Ok { result, .. } => {
                assert_eq!(result, t.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
        // apply(patchId: inv, content: t) -> ok(result: b)
        let step3 = handler.apply(
            ApplyInput { patch_id: inv.clone(), content: t.clone() },
            &storage,
        ).await.unwrap();
        match step3 {
            ApplyOutput::Ok { result, .. } => {
                assert_eq!(result, b.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
