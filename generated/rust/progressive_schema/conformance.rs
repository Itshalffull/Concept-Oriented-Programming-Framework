// generated: progressive_schema/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::ProgressiveSchemaHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn progressive_schema_invariant_1() {
        // invariant 1: after captureFreeform, detectStructure, acceptSuggestion behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        // --- AFTER clause ---
        // captureFreeform(content: "Meeting with John on 2026-03-01 about #project-x") -> ok(itemId: "ps-1")
        let step1 = handler.capture_freeform(
            CaptureFreeformInput { content: "Meeting with John on 2026-03-01 about #project-x".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            CaptureFreeformOutput::Ok { item_id, .. } => {
                assert_eq!(item_id, "ps-1".to_string());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // detectStructure(itemId: "ps-1") -> ok(suggestions: "[{\"field\":\"date\",\"value\":\"2026-03-01\",\"confidence\":0.95}]")
        let step2 = handler.detect_structure(
            DetectStructureInput { item_id: "ps-1".to_string() },
            &storage,
        ).await.unwrap();
        match step2 {
            DetectStructureOutput::Ok { suggestions, .. } => {
                assert_eq!(suggestions, "[{"field":"date","value":"2026-03-01","confidence":0.95}]".to_string());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
        // acceptSuggestion(itemId: "ps-1", suggestionId: "sug-1") -> ok()
        let step3 = handler.accept_suggestion(
            AcceptSuggestionInput { item_id: "ps-1".to_string(), suggestion_id: "sug-1".to_string() },
            &storage,
        ).await.unwrap();
        assert!(matches!(step3, AcceptSuggestionOutput::Ok));
    }

}
