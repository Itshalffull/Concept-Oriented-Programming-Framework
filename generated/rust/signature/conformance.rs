// generated: signature/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::SignatureHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn signature_invariant_1() {
        // invariant 1: after sign, verify behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let h = "u-test-invariant-001".to_string();
        let id = "u-test-invariant-002".to_string();
        let sig = "u-test-invariant-003".to_string();

        // --- AFTER clause ---
        // sign(contentHash: h, identity: id) -> ok(signatureId: sig)
        let step1 = handler.sign(
            SignInput { content_hash: h.clone(), identity: id.clone() },
            &storage,
        ).await.unwrap();
        match step1 {
            SignOutput::Ok { signature_id, .. } => {
                assert_eq!(signature_id, sig.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // verify(contentHash: h, signatureId: sig) -> valid(identity: id, timestamp: _)
        let step2 = handler.verify(
            VerifyInput { content_hash: h.clone(), signature_id: sig.clone() },
            &storage,
        ).await.unwrap();
        match step2 {
            VerifyOutput::Valid { identity, timestamp, .. } => {
                assert_eq!(identity, id.clone());
                assert_eq!(timestamp, .clone());
            },
            other => panic!("Expected Valid, got {:?}", other),
        }
    }

}
