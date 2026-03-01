// generated: score_api/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::ScoreApiHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn score_api_invariant_1() {
        // invariant 1: after reindex, status, listConcepts, listSyncs behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let c = "u-test-invariant-001".to_string();
        let s = "u-test-invariant-002".to_string();
        let f = "u-test-invariant-003".to_string();
        let y = "u-test-invariant-004".to_string();
        let d = "u-test-invariant-005".to_string();
        let t = "u-test-invariant-006".to_string();
        let concepts = "u-test-invariant-007".to_string();
        let syncs = "u-test-invariant-008".to_string();

        // --- AFTER clause ---
        // reindex() -> ok(conceptCount: c, symbolCount: s, fileCount: f, syncCount: y, duration: d)
        let step1 = handler.reindex(
            ReindexInput {  },
            &storage,
        ).await.unwrap();
        match step1 {
            ReindexOutput::Ok { concept_count, symbol_count, file_count, sync_count, duration, .. } => {
                assert_eq!(concept_count, c.clone());
                assert_eq!(symbol_count, s.clone());
                assert_eq!(file_count, f.clone());
                assert_eq!(sync_count, y.clone());
                assert_eq!(duration, d.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // status() -> ok(indexed: true, conceptCount: c, symbolCount: s, fileCount: f, syncCount: y, lastIndexed: t)
        let step2 = handler.status(
            StatusInput {  },
            &storage,
        ).await.unwrap();
        match step2 {
            StatusOutput::Ok { indexed, concept_count, symbol_count, file_count, sync_count, last_indexed, .. } => {
                assert_eq!(indexed, true);
                assert_eq!(concept_count, c.clone());
                assert_eq!(symbol_count, s.clone());
                assert_eq!(file_count, f.clone());
                assert_eq!(sync_count, y.clone());
                assert_eq!(last_indexed, t.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
        // listConcepts() -> ok(concepts: concepts)
        let step3 = handler.list_concepts(
            ListConceptsInput {  },
            &storage,
        ).await.unwrap();
        match step3 {
            ListConceptsOutput::Ok { concepts, .. } => {
                assert_eq!(concepts, concepts.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
        // listSyncs() -> ok(syncs: syncs)
        let step4 = handler.list_syncs(
            ListSyncsInput {  },
            &storage,
        ).await.unwrap();
        match step4 {
            ListSyncsOutput::Ok { syncs, .. } => {
                assert_eq!(syncs, syncs.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
