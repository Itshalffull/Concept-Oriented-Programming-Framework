// generated: gcp_sm_provider/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::GcpSmProviderHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn gcp_sm_provider_invariant_1() {
        // invariant 1: after fetch, rotate behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let v = "u-test-invariant-001".to_string();
        let vid = "u-test-invariant-002".to_string();
        let pid = "u-test-invariant-003".to_string();
        let nv = "u-test-invariant-004".to_string();

        // --- AFTER clause ---
        // fetch(secretId: "db-password", version: "latest") -> ok(value: v, versionId: vid, projectId: pid)
        let step1 = handler.fetch(
            FetchInput { secret_id: "db-password".to_string(), version: "latest".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            FetchOutput::Ok { value, version_id, project_id, .. } => {
                assert_eq!(value, v.clone());
                assert_eq!(version_id, vid.clone());
                assert_eq!(project_id, pid.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // rotate(secretId: "db-password") -> ok(secretId: "db-password", newVersionId: nv)
        let step2 = handler.rotate(
            RotateInput { secret_id: "db-password".to_string() },
            &storage,
        ).await.unwrap();
        match step2 {
            RotateOutput::Ok { secret_id, new_version_id, .. } => {
                assert_eq!(secret_id, "db-password".to_string());
                assert_eq!(new_version_id, nv.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
