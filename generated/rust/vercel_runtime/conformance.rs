// generated: vercel_runtime/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::VercelRuntimeHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn vercel_runtime_invariant_1() {
        // invariant 1: after provision, deploy behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let p = "u-test-invariant-001".to_string();
        let pid = "u-test-invariant-002".to_string();
        let ep = "u-test-invariant-003".to_string();
        let did = "u-test-invariant-004".to_string();
        let url = "u-test-invariant-005".to_string();

        // --- AFTER clause ---
        // provision(concept: "User", teamId: "team-1", framework: "nextjs") -> ok(project: p, projectId: pid, endpoint: ep)
        let step1 = handler.provision(
            ProvisionInput { concept: "User".to_string(), team_id: "team-1".to_string(), framework: "nextjs".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            ProvisionOutput::Ok { project, project_id, endpoint, .. } => {
                assert_eq!(project, p.clone());
                assert_eq!(project_id, pid.clone());
                assert_eq!(endpoint, ep.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // deploy(project: p, sourceDirectory: "./dist") -> ok(project: p, deploymentId: did, deploymentUrl: url)
        let step2 = handler.deploy(
            DeployInput { project: p.clone(), source_directory: "./dist".to_string() },
            &storage,
        ).await.unwrap();
        match step2 {
            DeployOutput::Ok { project, deployment_id, deployment_url, .. } => {
                assert_eq!(project, p.clone());
                assert_eq!(deployment_id, did.clone());
                assert_eq!(deployment_url, url.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
