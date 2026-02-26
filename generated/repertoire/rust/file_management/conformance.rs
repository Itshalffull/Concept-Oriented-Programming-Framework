// generated: file_management/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::FileManagementHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn file_management_invariant_1() {
        // invariant 1: after upload, addUsage, removeUsage, garbageCollect behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let f = "u-test-invariant-001".to_string();
        let d = "u-test-invariant-002".to_string();
        let m = "u-test-invariant-003".to_string();
        let e = "u-test-invariant-004".to_string();

        // --- AFTER clause ---
        // upload(file: f, data: d, mimeType: m) -> ok(file: f)
        let step1 = handler.upload(
            UploadInput { file: f.clone(), data: d.clone(), mime_type: m.clone() },
            &storage,
        ).await.unwrap();
        match step1 {
            UploadOutput::Ok { file, .. } => {
                assert_eq!(file, f.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // addUsage(file: f, entity: e) -> ok()
        let step2 = handler.add_usage(
            AddUsageInput { file: f.clone(), entity: e.clone() },
            &storage,
        ).await.unwrap();
        assert!(matches!(step2, AddUsageOutput::Ok));
        // removeUsage(file: f, entity: e) -> ok()
        let step3 = handler.remove_usage(
            RemoveUsageInput { file: f.clone(), entity: e.clone() },
            &storage,
        ).await.unwrap();
        assert!(matches!(step3, RemoveUsageOutput::Ok));
        // garbageCollect() -> ok(removed: 1)
        let step4 = handler.garbage_collect(
            GarbageCollectInput {  },
            &storage,
        ).await.unwrap();
        match step4 {
            GarbageCollectOutput::Ok { removed, .. } => {
                assert_eq!(removed, 1);
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
