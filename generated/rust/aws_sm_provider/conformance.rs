// generated: aws_sm_provider/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::AwsSmProviderHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn aws_sm_provider_invariant_1() {
        // invariant 1: after fetch, rotate behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let v = "u-test-invariant-001".to_string();
        let vid = "u-test-invariant-002".to_string();
        let a = "u-test-invariant-003".to_string();
        let nv = "u-test-invariant-004".to_string();

        // --- AFTER clause ---
        // fetch(secretId: "prod/db-password", versionStage: "AWSCURRENT") -> ok(value: v, versionId: vid, arn: a)
        let step1 = handler.fetch(
            FetchInput { secret_id: "prod/db-password".to_string(), version_stage: "AWSCURRENT".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            FetchOutput::Ok { value, version_id, arn, .. } => {
                assert_eq!(value, v.clone());
                assert_eq!(version_id, vid.clone());
                assert_eq!(arn, a.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // rotate(secretId: "prod/db-password") -> ok(secretId: "prod/db-password", newVersionId: nv)
        let step2 = handler.rotate(
            RotateInput { secret_id: "prod/db-password".to_string() },
            &storage,
        ).await.unwrap();
        match step2 {
            RotateOutput::Ok { secret_id, new_version_id, .. } => {
                assert_eq!(secret_id, "prod/db-password".to_string());
                assert_eq!(new_version_id, nv.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
