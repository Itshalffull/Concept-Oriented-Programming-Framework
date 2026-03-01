// generated: gcf_runtime/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::GcfRuntimeHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn gcf_runtime_invariant_1() {
        // invariant 1: after provision, deploy behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let f = "u-test-invariant-001".to_string();
        let ep = "u-test-invariant-002".to_string();

        // --- AFTER clause ---
        // provision(concept: "User", projectId: "my-project", region: "us-central1", runtime: "nodejs20", triggerType: "http") -> ok(function: f, endpoint: ep)
        let step1 = handler.provision(
            ProvisionInput { concept: "User".to_string(), project_id: "my-project".to_string(), region: "us-central1".to_string(), runtime: "nodejs20".to_string(), trigger_type: "http".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            ProvisionOutput::Ok { function, endpoint, .. } => {
                assert_eq!(function, f.clone());
                assert_eq!(endpoint, ep.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // deploy(function: f, sourceArchive: "gs://bucket/user.zip") -> ok(function: f, version: "1")
        let step2 = handler.deploy(
            DeployInput { function: f.clone(), source_archive: "gs://bucket/user.zip".to_string() },
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
