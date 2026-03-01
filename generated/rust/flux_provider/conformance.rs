// generated: flux_provider/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::FluxProviderHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn flux_provider_invariant_1() {
        // invariant 1: after emit, reconciliationStatus behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let k = "u-test-invariant-001".to_string();
        let f = "u-test-invariant-002".to_string();
        let rev = "u-test-invariant-003".to_string();
        let t = "u-test-invariant-004".to_string();

        // --- AFTER clause ---
        // emit(plan: "dp-001", repo: "git@github.com:org/deploy.git", path: "envs/prod") -> ok(kustomization: k, files: f)
        let step1 = handler.emit(
            EmitInput { plan: "dp-001".to_string(), repo: "git@github.com:org/deploy.git".to_string(), path: "envs/prod".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            EmitOutput::Ok { kustomization, files, .. } => {
                assert_eq!(kustomization, k.clone());
                assert_eq!(files, f.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // reconciliationStatus(kustomization: k) -> ok(kustomization: k, readyStatus: "True", appliedRevision: rev, reconciledAt: t)
        let step2 = handler.reconciliation_status(
            ReconciliationStatusInput { kustomization: k.clone() },
            &storage,
        ).await.unwrap();
        match step2 {
            ReconciliationStatusOutput::Ok { kustomization, ready_status, applied_revision, reconciled_at, .. } => {
                assert_eq!(kustomization, k.clone());
                assert_eq!(ready_status, "True".to_string());
                assert_eq!(applied_revision, rev.clone());
                assert_eq!(reconciled_at, t.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
