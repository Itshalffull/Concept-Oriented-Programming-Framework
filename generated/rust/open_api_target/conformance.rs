// generated: open_api_target/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::OpenApiTargetHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn open_api_target_invariant_1() {
        // invariant 1: after generate, generate behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let o = "u-test-invariant-001".to_string();
        let c = "u-test-invariant-002".to_string();
        let o2 = "u-test-invariant-003".to_string();
        let c2 = "u-test-invariant-004".to_string();

        // --- AFTER clause ---
        // generate(projections: ["proj-1", "proj-2"], config: "{}") -> ok(spec: o, content: c)
        let step1 = handler.generate(
            GenerateInput { projections: todo!(/* list: ["proj-1".to_string(), "proj-2".to_string()] */), config: "{}".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            GenerateOutput::Ok { spec, content, .. } => {
                assert_eq!(spec, o.clone());
                assert_eq!(content, c.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // generate(projections: ["proj-1"], config: "{}") -> ok(spec: o2, content: c2)
        let step2 = handler.generate(
            GenerateInput { projections: todo!(/* list: ["proj-1".to_string()] */), config: "{}".to_string() },
            &storage,
        ).await.unwrap();
        match step2 {
            GenerateOutput::Ok { spec, content, .. } => {
                assert_eq!(spec, o2.clone());
                assert_eq!(content, c2.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
