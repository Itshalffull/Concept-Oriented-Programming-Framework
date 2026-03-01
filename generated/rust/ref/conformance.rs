// generated: ref/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::RefHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn ref_invariant_1() {
        // invariant 1: after create, resolve behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let n = "u-test-invariant-001".to_string();
        let h = "u-test-invariant-002".to_string();
        let r = "u-test-invariant-003".to_string();

        // --- AFTER clause ---
        // create(name: n, hash: h) -> ok(ref: r)
        let step1 = handler.create(
            CreateInput { name: n.clone(), hash: h.clone() },
            &storage,
        ).await.unwrap();
        match step1 {
            CreateOutput::Ok { ref, .. } => {
                assert_eq!(ref, r.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // resolve(name: n) -> ok(hash: h)
        let step2 = handler.resolve(
            ResolveInput { name: n.clone() },
            &storage,
        ).await.unwrap();
        match step2 {
            ResolveOutput::Ok { hash, .. } => {
                assert_eq!(hash, h.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

    #[tokio::test]
    async fn ref_invariant_2() {
        // invariant 2: after update, resolve behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let n = "u-test-invariant-001".to_string();
        let h2 = "u-test-invariant-002".to_string();
        let h1 = "u-test-invariant-003".to_string();

        // --- AFTER clause ---
        // update(name: n, newHash: h2, expectedOldHash: h1) -> ok()
        let step1 = handler.update(
            UpdateInput { name: n.clone(), new_hash: h2.clone(), expected_old_hash: h1.clone() },
            &storage,
        ).await.unwrap();
        assert!(matches!(step1, UpdateOutput::Ok));

        // --- THEN clause ---
        // resolve(name: n) -> ok(hash: h2)
        let step2 = handler.resolve(
            ResolveInput { name: n.clone() },
            &storage,
        ).await.unwrap();
        match step2 {
            ResolveOutput::Ok { hash, .. } => {
                assert_eq!(hash, h2.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
