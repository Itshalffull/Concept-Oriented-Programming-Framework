// generated: migration/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::MigrationHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn migration_invariant_1() {
        // invariant 1: after plan, expand, migrate behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let m = "u-test-invariant-001".to_string();
        let s = "u-test-invariant-002".to_string();

        // --- AFTER clause ---
        // plan(concept: "Entity", fromVersion: 1, toVersion: 2) -> ok(migration: m, steps: s, estimatedRecords: 1000)
        let step1 = handler.plan(
            PlanInput { concept: "Entity".to_string(), from_version: 1, to_version: 2 },
            &storage,
        ).await.unwrap();
        match step1 {
            PlanOutput::Ok { migration, steps, estimated_records, .. } => {
                assert_eq!(migration, m.clone());
                assert_eq!(steps, s.clone());
                assert_eq!(estimated_records, 1000);
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // expand(migration: m) -> ok(migration: m)
        let step2 = handler.expand(
            ExpandInput { migration: m.clone() },
            &storage,
        ).await.unwrap();
        match step2 {
            ExpandOutput::Ok { migration, .. } => {
                assert_eq!(migration, m.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
        // migrate(migration: m) -> ok(migration: m, recordsMigrated: 1000)
        let step3 = handler.migrate(
            MigrateInput { migration: m.clone() },
            &storage,
        ).await.unwrap();
        match step3 {
            MigrateOutput::Ok { migration, records_migrated, .. } => {
                assert_eq!(migration, m.clone());
                assert_eq!(records_migrated, 1000);
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
