// generated: content_hash/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::ContentHashHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn content_hash_invariant_1() {
        // invariant 1: after store, retrieve behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let c = "u-test-invariant-001".to_string();
        let h = "u-test-invariant-002".to_string();

        // --- AFTER clause ---
        // store(content: c) -> ok(hash: h)
        let step1 = handler.store(
            StoreInput { content: c.clone() },
            &storage,
        ).await.unwrap();
        match step1 {
            StoreOutput::Ok { hash, .. } => {
                assert_eq!(hash, h.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // retrieve(hash: h) -> ok(content: c)
        let step2 = handler.retrieve(
            RetrieveInput { hash: h.clone() },
            &storage,
        ).await.unwrap();
        match step2 {
            RetrieveOutput::Ok { content, .. } => {
                assert_eq!(content, c.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

    #[tokio::test]
    async fn content_hash_invariant_2() {
        // invariant 2: after store, verify behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let c = "u-test-invariant-001".to_string();
        let h = "u-test-invariant-002".to_string();

        // --- AFTER clause ---
        // store(content: c) -> ok(hash: h)
        let step1 = handler.store(
            StoreInput { content: c.clone() },
            &storage,
        ).await.unwrap();
        match step1 {
            StoreOutput::Ok { hash, .. } => {
                assert_eq!(hash, h.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // verify(hash: h, content: c) -> valid()
        let step2 = handler.verify(
            VerifyInput { hash: h.clone(), content: c.clone() },
            &storage,
        ).await.unwrap();
        assert!(matches!(step2, VerifyOutput::Valid));
    }

    #[tokio::test]
    async fn content_hash_invariant_3() {
        // invariant 3: after store, store behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let c = "u-test-invariant-001".to_string();
        let h = "u-test-invariant-002".to_string();

        // --- AFTER clause ---
        // store(content: c) -> ok(hash: h)
        let step1 = handler.store(
            StoreInput { content: c.clone() },
            &storage,
        ).await.unwrap();
        match step1 {
            StoreOutput::Ok { hash, .. } => {
                assert_eq!(hash, h.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // store(content: c) -> alreadyExists(hash: h)
        let step2 = handler.store(
            StoreInput { content: c.clone() },
            &storage,
        ).await.unwrap();
        match step2 {
            StoreOutput::AlreadyExists { hash, .. } => {
                assert_eq!(hash, h.clone());
            },
            other => panic!("Expected AlreadyExists, got {:?}", other),
        }
    }

}
