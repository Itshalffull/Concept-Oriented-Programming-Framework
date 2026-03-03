// generated: evidence/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::EvidenceHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn evidence_invariant_1() {
        // invariant 1: after record, validate behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let c = "u-test-invariant-001".to_string();
        let m = "u-test-invariant-002".to_string();
        let e = "u-test-invariant-003".to_string();
        let h = "u-test-invariant-004".to_string();

        // --- AFTER clause ---
        // record(artifact_type: "proof_certificate", content: c, solver_metadata: m, property_ref: "prop-1", confidence_score: 1) -> ok(evidence: e, content_hash: h)
        let step1 = handler.record(
            RecordInput { artifact_type: "proof_certificate".to_string(), content: c.clone(), solver_metadata: m.clone(), property_ref: "prop-1".to_string(), confidence_score: 1 },
            &storage,
        ).await.unwrap();
        match step1 {
            RecordOutput::Ok { evidence, content_hash, .. } => {
                assert_eq!(evidence, e.clone());
                assert_eq!(content_hash, h.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // validate(evidence: e) -> ok(evidence: e, valid: true)
        let step2 = handler.validate(
            ValidateInput { evidence: e.clone() },
            &storage,
        ).await.unwrap();
        match step2 {
            ValidateOutput::Ok { evidence, valid, .. } => {
                assert_eq!(evidence, e.clone());
                assert_eq!(valid, true);
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}