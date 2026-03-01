// generated: data_quality/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::DataQualityHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn data_quality_invariant_1() {
        // invariant 1: after validate, inspect behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        // --- AFTER clause ---
        // validate(item: "{\"title\":\"Test\",\"body\":\"content\"}", rulesetId: "article_rules") -> ok(valid: "true", score: "0.95")
        let step1 = handler.validate(
            ValidateInput { item: "{"title":"Test","body":"content"}".to_string(), ruleset_id: "article_rules".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            ValidateOutput::Ok { valid, score, .. } => {
                assert_eq!(valid, "true".to_string());
                assert_eq!(score, "0.95".to_string());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // inspect(itemId: "item-1") -> ok(score: "0.95", violations: "[]")
        let step2 = handler.inspect(
            InspectInput { item_id: "item-1".to_string() },
            &storage,
        ).await.unwrap();
        match step2 {
            InspectOutput::Ok { score, violations, .. } => {
                assert_eq!(score, "0.95".to_string());
                assert_eq!(violations, "[]".to_string());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

    #[tokio::test]
    async fn data_quality_invariant_2() {
        // invariant 2: after validate, quarantine, release behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        // --- AFTER clause ---
        // validate(item: "{\"title\":\"\"}", rulesetId: "article_rules") -> invalid(violations: "[{\"rule\":\"required\",\"field\":\"title\"}]")
        let step1 = handler.validate(
            ValidateInput { item: "{"title":""}".to_string(), ruleset_id: "article_rules".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            ValidateOutput::Invalid { violations, .. } => {
                assert_eq!(violations, "[{"rule":"required","field":"title"}]".to_string());
            },
            other => panic!("Expected Invalid, got {:?}", other),
        }

        // --- THEN clause ---
        // quarantine(itemId: "item-1", violations: "[{\"rule\":\"required\",\"field\":\"title\"}]") -> ok()
        let step2 = handler.quarantine(
            QuarantineInput { item_id: "item-1".to_string(), violations: "[{"rule":"required","field":"title"}]".to_string() },
            &storage,
        ).await.unwrap();
        assert!(matches!(step2, QuarantineOutput::Ok));
        // release(itemId: "item-1") -> ok()
        let step3 = handler.release(
            ReleaseInput { item_id: "item-1".to_string() },
            &storage,
        ).await.unwrap();
        assert!(matches!(step3, ReleaseOutput::Ok));
    }

}
