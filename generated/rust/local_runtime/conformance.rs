// generated: local_runtime/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::LocalRuntimeHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn local_runtime_invariant_1() {
        // invariant 1: after provision, deploy behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let p = "u-test-invariant-001".to_string();
        let pid = "u-test-invariant-002".to_string();
        let ep = "u-test-invariant-003".to_string();
        let new_pid = "u-test-invariant-004".to_string();

        // --- AFTER clause ---
        // provision(concept: "User", command: "node server.js", port: 3000) -> ok(process: p, pid: pid, endpoint: ep)
        let step1 = handler.provision(
            ProvisionInput { concept: "User".to_string(), command: "node server.js".to_string(), port: 3000 },
            &storage,
        ).await.unwrap();
        match step1 {
            ProvisionOutput::Ok { process, pid, endpoint, .. } => {
                assert_eq!(process, p.clone());
                assert_eq!(pid, pid.clone());
                assert_eq!(endpoint, ep.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // deploy(process: p, command: "node server.js") -> ok(process: p, pid: newPid)
        let step2 = handler.deploy(
            DeployInput { process: p.clone(), command: "node server.js".to_string() },
            &storage,
        ).await.unwrap();
        match step2 {
            DeployOutput::Ok { process, pid, .. } => {
                assert_eq!(process, p.clone());
                assert_eq!(pid, new_pid.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
