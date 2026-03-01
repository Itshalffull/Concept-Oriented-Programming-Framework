// generated: score_index/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::ScoreIndexHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn score_index_invariant_1() {
        // invariant 1: after upsertConcept, stats behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let a = "u-test-invariant-001".to_string();
        let f = "u-test-invariant-002".to_string();
        let x = "u-test-invariant-003".to_string();
        let c = "u-test-invariant-004".to_string();
        let s = "u-test-invariant-005".to_string();
        let y = "u-test-invariant-006".to_string();
        let f2 = "u-test-invariant-007".to_string();
        let t = "u-test-invariant-008".to_string();

        // --- AFTER clause ---
        // upsertConcept(name: "Test", purpose: "A test concept", actions: a, stateFields: f, file: "/test.concept") -> ok(index: x)
        let step1 = handler.upsert_concept(
            UpsertConceptInput { name: "Test".to_string(), purpose: "A test concept".to_string(), actions: a.clone(), state_fields: f.clone(), file: "/test.concept".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            UpsertConceptOutput::Ok { index, .. } => {
                assert_eq!(index, x.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // stats() -> ok(conceptCount: c, syncCount: s, symbolCount: y, fileCount: f2, lastUpdated: t)
        let step2 = handler.stats(
            StatsInput {  },
            &storage,
        ).await.unwrap();
        match step2 {
            StatsOutput::Ok { concept_count, sync_count, symbol_count, file_count, last_updated, .. } => {
                assert_eq!(concept_count, c.clone());
                assert_eq!(sync_count, s.clone());
                assert_eq!(symbol_count, y.clone());
                assert_eq!(file_count, f2.clone());
                assert_eq!(last_updated, t.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
