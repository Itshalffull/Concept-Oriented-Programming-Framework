// generated: go_sdk_target/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::GoSdkTargetHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn go_sdk_target_invariant_1() {
        // invariant 1: after generate, generate behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let s = "u-test-invariant-001".to_string();
        let f = "u-test-invariant-002".to_string();
        let s2 = "u-test-invariant-003".to_string();
        let f2 = "u-test-invariant-004".to_string();

        // --- AFTER clause ---
        // generate(projection: "test-projection", config: "{}") -> ok(module: s, files: f)
        let step1 = handler.generate(
            GenerateInput { projection: "test-projection".to_string(), config: "{}".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            GenerateOutput::Ok { module, files, .. } => {
                assert_eq!(module, s.clone());
                assert_eq!(files, f.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // generate(projection: "test-projection-2", config: "{}") -> ok(module: s2, files: f2)
        let step2 = handler.generate(
            GenerateInput { projection: "test-projection-2".to_string(), config: "{}".to_string() },
            &storage,
        ).await.unwrap();
        match step2 {
            GenerateOutput::Ok { module, files, .. } => {
                assert_eq!(module, s2.clone());
                assert_eq!(files, f2.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
