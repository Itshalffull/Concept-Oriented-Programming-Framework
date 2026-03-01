// generated: ia_c/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::IaCHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn ia_c_invariant_1() {
        // invariant 1: after emit, apply behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let c = "u-test-invariant-001".to_string();
        let u = "u-test-invariant-002".to_string();
        let d = "u-test-invariant-003".to_string();

        // --- AFTER clause ---
        // emit(plan: "dp-001", provider: "pulumi") -> ok(output: "stack-ref", fileCount: 3)
        let step1 = handler.emit(
            EmitInput { plan: "dp-001".to_string(), provider: "pulumi".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            EmitOutput::Ok { output, file_count, .. } => {
                assert_eq!(output, "stack-ref".to_string());
                assert_eq!(file_count, 3);
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // apply(plan: "dp-001", provider: "pulumi") -> ok(created: c, updated: u, deleted: d)
        let step2 = handler.apply(
            ApplyInput { plan: "dp-001".to_string(), provider: "pulumi".to_string() },
            &storage,
        ).await.unwrap();
        match step2 {
            ApplyOutput::Ok { created, updated, deleted, .. } => {
                assert_eq!(created, c.clone());
                assert_eq!(updated, u.clone());
                assert_eq!(deleted, d.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
