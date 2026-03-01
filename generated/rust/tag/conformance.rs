// generated: tag/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::TagHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn tag_invariant_1() {
        // invariant 1: after addTag, getByTag behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let t = "u-test-invariant-001".to_string();

        // --- AFTER clause ---
        // addTag(entity: "page-1", tag: t) -> ok()
        let step1 = handler.add_tag(
            AddTagInput { entity: "page-1".to_string(), tag: t.clone() },
            &storage,
        ).await.unwrap();
        assert!(matches!(step1, AddTagOutput::Ok));

        // --- THEN clause ---
        // getByTag(tag: t) -> ok(entities: "page-1")
        let step2 = handler.get_by_tag(
            GetByTagInput { tag: t.clone() },
            &storage,
        ).await.unwrap();
        match step2 {
            GetByTagOutput::Ok { entities, .. } => {
                assert_eq!(entities, "page-1".to_string());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
