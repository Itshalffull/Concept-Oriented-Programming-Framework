// generated: version/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::VersionHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn version_invariant_1() {
        // invariant 1: after snapshot, listVersions, rollback behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let v1 = "u-test-invariant-001".to_string();

        // --- AFTER clause ---
        // snapshot(version: v1, entity: "doc", data: "original", author: "alice") -> ok(version: v1)
        let step1 = handler.snapshot(
            SnapshotInput { version: v1.clone(), entity: "doc".to_string(), data: "original".to_string(), author: "alice".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            SnapshotOutput::Ok { version, .. } => {
                assert_eq!(version, v1.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // listVersions(entity: "doc") -> ok(versions: "v1")
        let step2 = handler.list_versions(
            ListVersionsInput { entity: "doc".to_string() },
            &storage,
        ).await.unwrap();
        match step2 {
            ListVersionsOutput::Ok { versions, .. } => {
                assert_eq!(versions, "v1".to_string());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
        // rollback(version: v1) -> ok(data: "original")
        let step3 = handler.rollback(
            RollbackInput { version: v1.clone() },
            &storage,
        ).await.unwrap();
        match step3 {
            RollbackOutput::Ok { data, .. } => {
                assert_eq!(data, "original".to_string());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
