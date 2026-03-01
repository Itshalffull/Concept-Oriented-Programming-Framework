// generated: argo_c_d_provider/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::ArgoCDProviderHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn argo_c_d_provider_invariant_1() {
        // invariant 1: after emit, reconciliationStatus behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let a = "u-test-invariant-001".to_string();
        let f = "u-test-invariant-002".to_string();
        let t = "u-test-invariant-003".to_string();

        // --- AFTER clause ---
        // emit(plan: "dp-001", repo: "git@github.com:org/deploy.git", path: "envs/prod") -> ok(application: a, files: f)
        let step1 = handler.emit(
            EmitInput { plan: "dp-001".to_string(), repo: "git@github.com:org/deploy.git".to_string(), path: "envs/prod".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            EmitOutput::Ok { application, files, .. } => {
                assert_eq!(application, a.clone());
                assert_eq!(files, f.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // reconciliationStatus(application: a) -> ok(application: a, syncStatus: "Synced", healthStatus: "Healthy", reconciledAt: t)
        let step2 = handler.reconciliation_status(
            ReconciliationStatusInput { application: a.clone() },
            &storage,
        ).await.unwrap();
        match step2 {
            ReconciliationStatusOutput::Ok { application, sync_status, health_status, reconciled_at, .. } => {
                assert_eq!(application, a.clone());
                assert_eq!(sync_status, "Synced".to_string());
                assert_eq!(health_status, "Healthy".to_string());
                assert_eq!(reconciled_at, t.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
