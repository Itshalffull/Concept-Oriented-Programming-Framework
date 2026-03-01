// generated: cloudflare_runtime/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::CloudflareRuntimeHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn cloudflare_runtime_invariant_1() {
        // invariant 1: after provision, deploy behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let r = "u-test-invariant-001".to_string();
        let w = "u-test-invariant-002".to_string();
        let sn = "u-test-invariant-003".to_string();
        let ep = "u-test-invariant-004".to_string();

        // --- AFTER clause ---
        // provision(concept: "User", accountId: "abc123", routes: r) -> ok(worker: w, scriptName: sn, endpoint: ep)
        let step1 = handler.provision(
            ProvisionInput { concept: "User".to_string(), account_id: "abc123".to_string(), routes: r.clone() },
            &storage,
        ).await.unwrap();
        match step1 {
            ProvisionOutput::Ok { worker, script_name, endpoint, .. } => {
                assert_eq!(worker, w.clone());
                assert_eq!(script_name, sn.clone());
                assert_eq!(endpoint, ep.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // deploy(worker: w, scriptContent: "export default { fetch() {} }") -> ok(worker: w, version: "1")
        let step2 = handler.deploy(
            DeployInput { worker: w.clone(), script_content: "export default { fetch() {} }".to_string() },
            &storage,
        ).await.unwrap();
        match step2 {
            DeployOutput::Ok { worker, version, .. } => {
                assert_eq!(worker, w.clone());
                assert_eq!(version, "1".to_string());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
