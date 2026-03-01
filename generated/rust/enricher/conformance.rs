// generated: enricher/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::EnricherHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn enricher_invariant_1() {
        // invariant 1: after enrich, accept behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        // --- AFTER clause ---
        // enrich(itemId: "item-1", enricherId: "auto_tag") -> ok(enrichmentId: "enr-1", result: "[\"tech\",\"ai\"]", confidence: "0.92")
        let step1 = handler.enrich(
            EnrichInput { item_id: "item-1".to_string(), enricher_id: "auto_tag".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            EnrichOutput::Ok { enrichment_id, result, confidence, .. } => {
                assert_eq!(enrichment_id, "enr-1".to_string());
                assert_eq!(result, "["tech","ai"]".to_string());
                assert_eq!(confidence, "0.92".to_string());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // accept(itemId: "item-1", enrichmentId: "enr-1") -> ok()
        let step2 = handler.accept(
            AcceptInput { item_id: "item-1".to_string(), enrichment_id: "enr-1".to_string() },
            &storage,
        ).await.unwrap();
        assert!(matches!(step2, AcceptOutput::Ok));
    }

}
