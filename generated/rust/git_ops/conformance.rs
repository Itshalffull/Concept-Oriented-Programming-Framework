// generated: git_ops/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::GitOpsHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn git_ops_invariant_1() {
        // invariant 1: after emit, reconciliationStatus behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let g = "u-test-invariant-001".to_string();
        let f = "u-test-invariant-002".to_string();
        let t = "u-test-invariant-003".to_string();

        // --- AFTER clause ---
        // emit(plan: "dp-001", controller: "argocd", repo: "git@github.com:org/deploy.git", path: "envs/prod") -> ok(manifest: g, files: f)
        let step1 = handler.emit(
            EmitInput { plan: "dp-001".to_string(), controller: "argocd".to_string(), repo: "git@github.com:org/deploy.git".to_string(), path: "envs/prod".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            EmitOutput::Ok { manifest, files, .. } => {
                assert_eq!(manifest, g.clone());
                assert_eq!(files, f.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // reconciliationStatus(manifest: g) -> ok(manifest: g, status: "synced", reconciledAt: t)
        let step2 = handler.reconciliation_status(
            ReconciliationStatusInput { manifest: g.clone() },
            &storage,
        ).await.unwrap();
        match step2 {
            ReconciliationStatusOutput::Ok { manifest, status, reconciled_at, .. } => {
                assert_eq!(manifest, g.clone());
                assert_eq!(status, "synced".to_string());
                assert_eq!(reconciled_at, t.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
