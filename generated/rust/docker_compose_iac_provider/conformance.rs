// generated: docker_compose_iac_provider/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::DockerComposeIacProviderHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn docker_compose_iac_provider_invariant_1() {
        // invariant 1: after generate, apply behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let cf = "u-test-invariant-001".to_string();
        let f = "u-test-invariant-002".to_string();
        let c = "u-test-invariant-003".to_string();
        let u = "u-test-invariant-004".to_string();

        // --- AFTER clause ---
        // generate(plan: "dp-001") -> ok(composeFile: cf, files: f)
        let step1 = handler.generate(
            GenerateInput { plan: "dp-001".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            GenerateOutput::Ok { compose_file, files, .. } => {
                assert_eq!(compose_file, cf.clone());
                assert_eq!(files, f.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // apply(composeFile: cf) -> ok(composeFile: cf, created: c, updated: u)
        let step2 = handler.apply(
            ApplyInput { compose_file: cf.clone() },
            &storage,
        ).await.unwrap();
        match step2 {
            ApplyOutput::Ok { compose_file, created, updated, .. } => {
                assert_eq!(compose_file, cf.clone());
                assert_eq!(created, c.clone());
                assert_eq!(updated, u.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
