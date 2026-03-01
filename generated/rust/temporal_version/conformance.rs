// generated: temporal_version/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::TemporalVersionHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn temporal_version_invariant_1() {
        // invariant 1: after record, asOf behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let h = "u-test-invariant-001".to_string();
        let vf = "u-test-invariant-002".to_string();
        let v = "u-test-invariant-003".to_string();

        // --- AFTER clause ---
        // record(contentHash: h, validFrom: vf, validTo: _, metadata: _) -> ok(versionId: v)
        let step1 = handler.record(
            RecordInput { content_hash: h.clone(), valid_from: vf.clone(), valid_to: .clone(), metadata: .clone() },
            &storage,
        ).await.unwrap();
        match step1 {
            RecordOutput::Ok { version_id, .. } => {
                assert_eq!(version_id, v.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // asOf(systemTime: _, validTime: vf) -> ok(versionId: v, contentHash: h)
        let step2 = handler.as_of(
            AsOfInput { system_time: .clone(), valid_time: vf.clone() },
            &storage,
        ).await.unwrap();
        match step2 {
            AsOfOutput::Ok { version_id, content_hash, .. } => {
                assert_eq!(version_id, v.clone());
                assert_eq!(content_hash, h.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

    #[tokio::test]
    async fn temporal_version_invariant_2() {
        // invariant 2: after record, current behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let h = "u-test-invariant-001".to_string();
        let v = "u-test-invariant-002".to_string();

        // --- AFTER clause ---
        // record(contentHash: h, validFrom: _, validTo: _, metadata: _) -> ok(versionId: v)
        let step1 = handler.record(
            RecordInput { content_hash: h.clone(), valid_from: .clone(), valid_to: .clone(), metadata: .clone() },
            &storage,
        ).await.unwrap();
        match step1 {
            RecordOutput::Ok { version_id, .. } => {
                assert_eq!(version_id, v.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // current() -> ok(versionId: v, contentHash: h)
        let step2 = handler.current(
            CurrentInput {  },
            &storage,
        ).await.unwrap();
        match step2 {
            CurrentOutput::Ok { version_id, content_hash, .. } => {
                assert_eq!(version_id, v.clone());
                assert_eq!(content_hash, h.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
