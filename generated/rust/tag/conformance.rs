// generated: tag/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::TagHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn tag_invariant_1() {
        // invariant 1: after add, add behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let t = "u-test-invariant-001".to_string();

        // --- AFTER clause ---
        // add(tag: t, article: "a1") -> ok(tag: t)
        let step1 = handler.add(
            AddInput { tag: t.clone(), article: "a1".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            AddOutput::Ok { tag, .. } => {
                assert_eq!(tag, t.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // add(tag: t, article: "a2") -> ok(tag: t)
        let step2 = handler.add(
            AddInput { tag: t.clone(), article: "a2".to_string() },
            &storage,
        ).await.unwrap();
        match step2 {
            AddOutput::Ok { tag, .. } => {
                assert_eq!(tag, t.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
