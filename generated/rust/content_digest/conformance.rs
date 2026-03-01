// generated: content_digest/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::ContentDigestHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn content_digest_invariant_1() {
        // invariant 1: after compute, lookup behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let d = "u-test-invariant-001".to_string();
        let u = "u-test-invariant-002".to_string();

        // --- AFTER clause ---
        // compute(unit: "u1", algorithm: "structural-normalized") -> ok(digest: d)
        let step1 = handler.compute(
            ComputeInput { unit: "u1".to_string(), algorithm: "structural-normalized".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            ComputeOutput::Ok { digest, .. } => {
                assert_eq!(digest, d.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // lookup(hash: "h") -> ok(units: u)
        let step2 = handler.lookup(
            LookupInput { hash: "h".to_string() },
            &storage,
        ).await.unwrap();
        match step2 {
            LookupOutput::Ok { units, .. } => {
                assert_eq!(units, u.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
