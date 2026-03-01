// generated: content/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::ContentHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn content_invariant_1() {
        // invariant 1: after store, resolve behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let d = "u-test-invariant-001".to_string();
        let c = "u-test-invariant-002".to_string();
        let s = "u-test-invariant-003".to_string();

        // --- AFTER clause ---
        // store(data: d, name: "test.txt", contentType: "text/plain") -> ok(cid: c, size: s)
        let step1 = handler.store(
            StoreInput { data: d.clone(), name: "test.txt".to_string(), content_type: "text/plain".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            StoreOutput::Ok { cid, size, .. } => {
                assert_eq!(cid, c.clone());
                assert_eq!(size, s.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // resolve(cid: c) -> ok(data: d, contentType: "text/plain", size: s)
        let step2 = handler.resolve(
            ResolveInput { cid: c.clone() },
            &storage,
        ).await.unwrap();
        match step2 {
            ResolveOutput::Ok { data, content_type, size, .. } => {
                assert_eq!(data, d.clone());
                assert_eq!(content_type, "text/plain".to_string());
                assert_eq!(size, s.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
