// generated: cloud_formation_provider/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::CloudFormationProviderHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn cloud_formation_provider_invariant_1() {
        // invariant 1: after generate, apply behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let s = "u-test-invariant-001".to_string();
        let f = "u-test-invariant-002".to_string();
        let sid = "u-test-invariant-003".to_string();
        let c = "u-test-invariant-004".to_string();
        let u = "u-test-invariant-005".to_string();

        // --- AFTER clause ---
        // generate(plan: "dp-001") -> ok(stack: s, files: f)
        let step1 = handler.generate(
            GenerateInput { plan: "dp-001".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            GenerateOutput::Ok { stack, files, .. } => {
                assert_eq!(stack, s.clone());
                assert_eq!(files, f.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // apply(stack: s) -> ok(stack: s, stackId: sid, created: c, updated: u)
        let step2 = handler.apply(
            ApplyInput { stack: s.clone() },
            &storage,
        ).await.unwrap();
        match step2 {
            ApplyOutput::Ok { stack, stack_id, created, updated, .. } => {
                assert_eq!(stack, s.clone());
                assert_eq!(stack_id, sid.clone());
                assert_eq!(created, c.clone());
                assert_eq!(updated, u.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
