// generated: branch/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::BranchHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn branch_invariant_1() {
        // invariant 1: after create, advance behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let n = "u-test-invariant-001".to_string();
        let f = "u-test-invariant-002".to_string();
        let b = "u-test-invariant-003".to_string();
        let n2 = "u-test-invariant-004".to_string();

        // --- AFTER clause ---
        // create(name: n, fromNode: f) -> ok(branch: b)
        let step1 = handler.create(
            CreateInput { name: n.clone(), from_node: f.clone() },
            &storage,
        ).await.unwrap();
        match step1 {
            CreateOutput::Ok { branch, .. } => {
                assert_eq!(branch, b.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // advance(branch: b, newNode: n2) -> ok()
        let step2 = handler.advance(
            AdvanceInput { branch: b.clone(), new_node: n2.clone() },
            &storage,
        ).await.unwrap();
        assert!(matches!(step2, AdvanceOutput::Ok));
    }

    #[tokio::test]
    async fn branch_invariant_2() {
        // invariant 2: after protect, advance behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let b = "u-test-invariant-001".to_string();

        // --- AFTER clause ---
        // protect(branch: b) -> ok()
        let step1 = handler.protect(
            ProtectInput { branch: b.clone() },
            &storage,
        ).await.unwrap();
        assert!(matches!(step1, ProtectOutput::Ok));

        // --- THEN clause ---
        // advance(branch: b, newNode: _) -> protected(message: _)
        let step2 = handler.advance(
            AdvanceInput { branch: b.clone(), new_node: .clone() },
            &storage,
        ).await.unwrap();
        match step2 {
            AdvanceOutput::Protected { message, .. } => {
                assert_eq!(message, .clone());
            },
            other => panic!("Expected Protected, got {:?}", other),
        }
    }

}
