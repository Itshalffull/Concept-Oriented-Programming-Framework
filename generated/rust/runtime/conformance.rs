// generated: runtime/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::RuntimeHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn runtime_invariant_1() {
        // invariant 1: after provision, deploy behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let i = "u-test-invariant-001".to_string();

        // --- AFTER clause ---
        // provision(concept: "User", runtimeType: "ecs-fargate", config: "{}") -> ok(instance: i, endpoint: "http://svc:8080")
        let step1 = handler.provision(
            ProvisionInput { concept: "User".to_string(), runtime_type: "ecs-fargate".to_string(), config: "{}".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            ProvisionOutput::Ok { instance, endpoint, .. } => {
                assert_eq!(instance, i.clone());
                assert_eq!(endpoint, "http://svc:8080".to_string());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // deploy(instance: i, artifact: "s3://artifacts/user-v1", version: "1.0.0") -> ok(instance: i, endpoint: "http://svc:8080")
        let step2 = handler.deploy(
            DeployInput { instance: i.clone(), artifact: "s3://artifacts/user-v1".to_string(), version: "1.0.0".to_string() },
            &storage,
        ).await.unwrap();
        match step2 {
            DeployOutput::Ok { instance, endpoint, .. } => {
                assert_eq!(instance, i.clone());
                assert_eq!(endpoint, "http://svc:8080".to_string());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
