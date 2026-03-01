// generated: ecs_runtime/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::EcsRuntimeHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn ecs_runtime_invariant_1() {
        // invariant 1: after provision, deploy behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let s = "u-test-invariant-001".to_string();
        let arn = "u-test-invariant-002".to_string();
        let ep = "u-test-invariant-003".to_string();
        let td = "u-test-invariant-004".to_string();

        // --- AFTER clause ---
        // provision(concept: "User", cpu: 256, memory: 512, cluster: "prod-cluster") -> ok(service: s, serviceArn: arn, endpoint: ep)
        let step1 = handler.provision(
            ProvisionInput { concept: "User".to_string(), cpu: 256, memory: 512, cluster: "prod-cluster".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            ProvisionOutput::Ok { service, service_arn, endpoint, .. } => {
                assert_eq!(service, s.clone());
                assert_eq!(service_arn, arn.clone());
                assert_eq!(endpoint, ep.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // deploy(service: s, imageUri: "ecr.aws/user:latest") -> ok(service: s, taskDefinition: td)
        let step2 = handler.deploy(
            DeployInput { service: s.clone(), image_uri: "ecr.aws/user:latest".to_string() },
            &storage,
        ).await.unwrap();
        match step2 {
            DeployOutput::Ok { service, task_definition, .. } => {
                assert_eq!(service, s.clone());
                assert_eq!(task_definition, td.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
