// generated: health/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::HealthHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn health_invariant_1() {
        // invariant 1: after checkConcept, checkKit behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let h = "u-test-invariant-001".to_string();
        let h2 = "u-test-invariant-002".to_string();
        let cr = "u-test-invariant-003".to_string();
        let sr = "u-test-invariant-004".to_string();

        // --- AFTER clause ---
        // checkConcept(concept: "User", runtime: "server") -> ok(check: h, latencyMs: 15)
        let step1 = handler.check_concept(
            CheckConceptInput { concept: "User".to_string(), runtime: "server".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            CheckConceptOutput::Ok { check, latency_ms, .. } => {
                assert_eq!(check, h.clone());
                assert_eq!(latency_ms, 15);
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // checkKit(kit: "auth", environment: "staging") -> ok(check: h2, conceptResults: cr, syncResults: sr)
        let step2 = handler.check_kit(
            CheckKitInput { kit: "auth".to_string(), environment: "staging".to_string() },
            &storage,
        ).await.unwrap();
        match step2 {
            CheckKitOutput::Ok { check, concept_results, sync_results, .. } => {
                assert_eq!(check, h2.clone());
                assert_eq!(concept_results, cr.clone());
                assert_eq!(sync_results, sr.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
