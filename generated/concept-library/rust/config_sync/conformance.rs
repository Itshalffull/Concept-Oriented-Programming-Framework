// generated: config_sync/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::ConfigSyncHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn config_sync_invariant_1() {
        // invariant 1: after export, import, export behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let c = "u-test-invariant-001".to_string();
        let d = "u-test-invariant-002".to_string();

        // --- AFTER clause ---
        // export(config: c) -> ok(data: d)
        let step1 = handler.export(
            ExportInput { config: c.clone() },
            &storage,
        ).await.unwrap();
        match step1 {
            ExportOutput::Ok { data, .. } => {
                assert_eq!(data, d.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // import(config: c, data: d) -> ok()
        let step2 = handler.import(
            ImportInput { config: c.clone(), data: d.clone() },
            &storage,
        ).await.unwrap();
        assert!(matches!(step2, ImportOutput::Ok));
        // export(config: c) -> ok(data: d)
        let step3 = handler.export(
            ExportInput { config: c.clone() },
            &storage,
        ).await.unwrap();
        match step3 {
            ExportOutput::Ok { data, .. } => {
                assert_eq!(data, d.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

    #[tokio::test]
    async fn config_sync_invariant_2() {
        // invariant 2: after override, export behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let c = "u-test-invariant-001".to_string();
        let d = "u-test-invariant-002".to_string();

        // --- AFTER clause ---
        // override(config: c, layer: "production", values: "debug=false") -> ok()
        let step1 = handler.override(
            OverrideInput { config: c.clone(), layer: "production".to_string(), values: "debug=false".to_string() },
            &storage,
        ).await.unwrap();
        assert!(matches!(step1, OverrideOutput::Ok));

        // --- THEN clause ---
        // export(config: c) -> ok(data: d)
        let step2 = handler.export(
            ExportInput { config: c.clone() },
            &storage,
        ).await.unwrap();
        match step2 {
            ExportOutput::Ok { data, .. } => {
                assert_eq!(data, d.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
