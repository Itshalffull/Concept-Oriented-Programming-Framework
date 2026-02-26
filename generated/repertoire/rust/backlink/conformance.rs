// generated: backlink/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::BacklinkHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn backlink_invariant_1() {
        // invariant 1: after reindex, getBacklinks behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let n = "u-test-invariant-001".to_string();
        let x = "u-test-invariant-002".to_string();
        let s = "u-test-invariant-003".to_string();

        // --- AFTER clause ---
        // reindex() -> ok(count: n)
        let step1 = handler.reindex(
            ReindexInput {  },
            &storage,
        ).await.unwrap();
        match step1 {
            ReindexOutput::Ok { count, .. } => {
                assert_eq!(count, n.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // getBacklinks(entity: x) -> ok(sources: s)
        let step2 = handler.get_backlinks(
            GetBacklinksInput { entity: x.clone() },
            &storage,
        ).await.unwrap();
        match step2 {
            GetBacklinksOutput::Ok { sources, .. } => {
                assert_eq!(sources, s.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
