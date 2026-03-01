// generated: cloud_run_runtime/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::CloudRunRuntimeHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn cloud_run_runtime_invariant_1() {
        // invariant 1: after provision, deploy behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let s = "u-test-invariant-001".to_string();
        let url = "u-test-invariant-002".to_string();
        let ep = "u-test-invariant-003".to_string();
        let r = "u-test-invariant-004".to_string();

        // --- AFTER clause ---
        // provision(concept: "User", projectId: "my-project", region: "us-central1", cpu: 1, memory: 512) -> ok(service: s, serviceUrl: url, endpoint: ep)
        let step1 = handler.provision(
            ProvisionInput { concept: "User".to_string(), project_id: "my-project".to_string(), region: "us-central1".to_string(), cpu: 1, memory: 512 },
            &storage,
        ).await.unwrap();
        match step1 {
            ProvisionOutput::Ok { service, service_url, endpoint, .. } => {
                assert_eq!(service, s.clone());
                assert_eq!(service_url, url.clone());
                assert_eq!(endpoint, ep.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // deploy(service: s, imageUri: "gcr.io/my-project/user:latest") -> ok(service: s, revision: r)
        let step2 = handler.deploy(
            DeployInput { service: s.clone(), image_uri: "gcr.io/my-project/user:latest".to_string() },
            &storage,
        ).await.unwrap();
        match step2 {
            DeployOutput::Ok { service, revision, .. } => {
                assert_eq!(service, s.clone());
                assert_eq!(revision, r.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
