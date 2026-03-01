// generated: docker_compose_runtime/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::DockerComposeRuntimeHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn docker_compose_runtime_invariant_1() {
        // invariant 1: after provision, deploy behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let p = "u-test-invariant-001".to_string();
        let s = "u-test-invariant-002".to_string();
        let sn = "u-test-invariant-003".to_string();
        let ep = "u-test-invariant-004".to_string();
        let cid = "u-test-invariant-005".to_string();

        // --- AFTER clause ---
        // provision(concept: "User", composePath: "./docker-compose.yml", ports: p) -> ok(service: s, serviceName: sn, endpoint: ep)
        let step1 = handler.provision(
            ProvisionInput { concept: "User".to_string(), compose_path: "./docker-compose.yml".to_string(), ports: p.clone() },
            &storage,
        ).await.unwrap();
        match step1 {
            ProvisionOutput::Ok { service, service_name, endpoint, .. } => {
                assert_eq!(service, s.clone());
                assert_eq!(service_name, sn.clone());
                assert_eq!(endpoint, ep.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // deploy(service: s, imageUri: "user:latest") -> ok(service: s, containerId: cid)
        let step2 = handler.deploy(
            DeployInput { service: s.clone(), image_uri: "user:latest".to_string() },
            &storage,
        ).await.unwrap();
        match step2 {
            DeployOutput::Ok { service, container_id, .. } => {
                assert_eq!(service, s.clone());
                assert_eq!(container_id, cid.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
