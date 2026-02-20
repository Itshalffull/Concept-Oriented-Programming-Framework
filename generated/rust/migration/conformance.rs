// generated: migration/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::MigrationHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn migration_invariant_1() {
        // invariant 1: after complete, check behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        // --- AFTER clause ---
        // complete(concept: "c1", version: 1) -> ok()
        let step1 = handler.complete(
            CompleteInput { concept: "c1".to_string(), version: 1 },
            &storage,
        ).await.unwrap();
        assert!(matches!(step1, CompleteOutput::Ok));

        // --- THEN clause ---
        // check(concept: "c1", specVersion: 2) -> needsMigration(from: 1, to: 2)
        let step2 = handler.check(
            CheckInput { concept: "c1".to_string(), spec_version: 2 },
            &storage,
        ).await.unwrap();
        match step2 {
            CheckOutput::NeedsMigration { from, to, .. } => {
                assert_eq!(from, 1);
                assert_eq!(to, 2);
            },
            other => panic!("Expected NeedsMigration, got {:?}", other),
        }
    }

}
