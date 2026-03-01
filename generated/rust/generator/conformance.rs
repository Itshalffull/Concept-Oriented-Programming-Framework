// generated: generator/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::GeneratorHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn generator_invariant_1() {
        // invariant 1: after plan, generate behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let g = "u-test-invariant-001".to_string();
        let t = "u-test-invariant-002".to_string();
        let c = "u-test-invariant-003".to_string();

        // --- AFTER clause ---
        // plan(kit: "test-kit", interfaceManifest: "valid-manifest") -> ok(plan: g, targets: t, concepts: c, estimatedFiles: 10)
        let step1 = handler.plan(
            PlanInput { kit: "test-kit".to_string(), interface_manifest: "valid-manifest".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            PlanOutput::Ok { plan, targets, concepts, estimated_files, .. } => {
                assert_eq!(plan, g.clone());
                assert_eq!(targets, t.clone());
                assert_eq!(concepts, c.clone());
                assert_eq!(estimated_files, 10);
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // generate(plan: g) -> ok(plan: g, filesGenerated: 10, filesUnchanged: 0, duration: 500)
        let step2 = handler.generate(
            GenerateInput { plan: g.clone() },
            &storage,
        ).await.unwrap();
        match step2 {
            GenerateOutput::Ok { plan, files_generated, files_unchanged, duration, .. } => {
                assert_eq!(plan, g.clone());
                assert_eq!(files_generated, 10);
                assert_eq!(files_unchanged, 0);
                assert_eq!(duration, 500);
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
