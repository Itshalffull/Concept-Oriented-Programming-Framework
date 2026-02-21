// generated: cache/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::CacheHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn cache_invariant_1() {
        // invariant 1: after set, get behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let b = "u-test-invariant-001".to_string();

        // --- AFTER clause ---
        // set(bin: b, key: "k", data: "v", tags: "t1", maxAge: 300) -> ok()
        let step1 = handler.set(
            SetInput { bin: b.clone(), key: "k".to_string(), data: "v".to_string(), tags: "t1".to_string(), max_age: 300 },
            &storage,
        ).await.unwrap();
        assert!(matches!(step1, SetOutput::Ok));

        // --- THEN clause ---
        // get(bin: b, key: "k") -> ok(data: "v")
        let step2 = handler.get(
            GetInput { bin: b.clone(), key: "k".to_string() },
            &storage,
        ).await.unwrap();
        match step2 {
            GetOutput::Ok { data, .. } => {
                assert_eq!(data, "v".to_string());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

    #[tokio::test]
    async fn cache_invariant_2() {
        // invariant 2: after set, invalidateByTags, get behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let b = "u-test-invariant-001".to_string();

        // --- AFTER clause ---
        // set(bin: b, key: "k", data: "v", tags: "t1", maxAge: 300) -> ok()
        let step1 = handler.set(
            SetInput { bin: b.clone(), key: "k".to_string(), data: "v".to_string(), tags: "t1".to_string(), max_age: 300 },
            &storage,
        ).await.unwrap();
        assert!(matches!(step1, SetOutput::Ok));

        // --- THEN clause ---
        // invalidateByTags(tags: "t1") -> ok(count: 1)
        let step2 = handler.invalidate_by_tags(
            InvalidateByTagsInput { tags: "t1".to_string() },
            &storage,
        ).await.unwrap();
        match step2 {
            InvalidateByTagsOutput::Ok { count, .. } => {
                assert_eq!(count, 1);
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
        // get(bin: b, key: "k") -> miss()
        let step3 = handler.get(
            GetInput { bin: b.clone(), key: "k".to_string() },
            &storage,
        ).await.unwrap();
        assert!(matches!(step3, GetOutput::Miss));
    }

}
