// generated: lambda_runtime/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::LambdaRuntimeHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn lambda_runtime_invariant_1() {
        // invariant 1: after provision, deploy behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let f = "u-test-invariant-001".to_string();
        let arn = "u-test-invariant-002".to_string();
        let ep = "u-test-invariant-003".to_string();

        // --- AFTER clause ---
        // provision(concept: "User", memory: 256, timeout: 30, region: "us-east-1") -> ok(function: f, functionArn: arn, endpoint: ep)
        let step1 = handler.provision(
            ProvisionInput { concept: "User".to_string(), memory: 256, timeout: 30, region: "us-east-1".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            ProvisionOutput::Ok { function, function_arn, endpoint, .. } => {
                assert_eq!(function, f.clone());
                assert_eq!(function_arn, arn.clone());
                assert_eq!(endpoint, ep.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // deploy(function: f, artifactLocation: "s3://bucket/user.zip") -> ok(function: f, version: "1")
        let step2 = handler.deploy(
            DeployInput { function: f.clone(), artifact_location: "s3://bucket/user.zip".to_string() },
            &storage,
        ).await.unwrap();
        match step2 {
            DeployOutput::Ok { function, version, .. } => {
                assert_eq!(function, f.clone());
                assert_eq!(version, "1".to_string());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
