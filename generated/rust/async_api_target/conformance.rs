// generated: async_api_target/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::AsyncApiTargetHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn async_api_target_invariant_1() {
        // invariant 1: after generate, generate behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let a = "u-test-invariant-001".to_string();
        let c = "u-test-invariant-002".to_string();
        let a2 = "u-test-invariant-003".to_string();
        let c2 = "u-test-invariant-004".to_string();

        // --- AFTER clause ---
        // generate(projections: ["proj-1"], syncSpecs: ["sync-1"], config: "{}") -> ok(spec: a, content: c)
        let step1 = handler.generate(
            GenerateInput { projections: todo!(/* list: ["proj-1".to_string()] */), sync_specs: todo!(/* list: ["sync-1".to_string()] */), config: "{}".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            GenerateOutput::Ok { spec, content, .. } => {
                assert_eq!(spec, a.clone());
                assert_eq!(content, c.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // generate(projections: ["proj-2"], syncSpecs: ["sync-2"], config: "{}") -> ok(spec: a2, content: c2)
        let step2 = handler.generate(
            GenerateInput { projections: todo!(/* list: ["proj-2".to_string()] */), sync_specs: todo!(/* list: ["sync-2".to_string()] */), config: "{}".to_string() },
            &storage,
        ).await.unwrap();
        match step2 {
            GenerateOutput::Ok { spec, content, .. } => {
                assert_eq!(spec, a2.clone());
                assert_eq!(content, c2.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
