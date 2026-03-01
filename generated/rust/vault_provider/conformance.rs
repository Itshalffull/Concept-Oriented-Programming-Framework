// generated: vault_provider/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::VaultProviderHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn vault_provider_invariant_1() {
        // invariant 1: after fetch, renewLease behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let v = "u-test-invariant-001".to_string();
        let lid = "u-test-invariant-002".to_string();

        // --- AFTER clause ---
        // fetch(path: "secret/data/db-password") -> ok(value: v, leaseId: lid, leaseDuration: 3600)
        let step1 = handler.fetch(
            FetchInput { path: "secret/data/db-password".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            FetchOutput::Ok { value, lease_id, lease_duration, .. } => {
                assert_eq!(value, v.clone());
                assert_eq!(lease_id, lid.clone());
                assert_eq!(lease_duration, 3600);
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // renewLease(leaseId: lid) -> ok(leaseId: lid, newDuration: 3600)
        let step2 = handler.renew_lease(
            RenewLeaseInput { lease_id: lid.clone() },
            &storage,
        ).await.unwrap();
        match step2 {
            RenewLeaseOutput::Ok { lease_id, new_duration, .. } => {
                assert_eq!(lease_id, lid.clone());
                assert_eq!(new_duration, 3600);
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
