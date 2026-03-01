// generated: resource/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::ResourceHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn resource_invariant_1() {
        // invariant 1: after upsert, get, upsert, upsert behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let r = "u-test-invariant-001".to_string();

        // --- AFTER clause ---
        // upsert(locator: "./specs/password.concept", kind: "concept-spec", digest: "abc123") -> created(resource: r)
        let step1 = handler.upsert(
            UpsertInput { locator: "./specs/password.concept".to_string(), kind: "concept-spec".to_string(), digest: "abc123".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            UpsertOutput::Created { resource, .. } => {
                assert_eq!(resource, r.clone());
            },
            other => panic!("Expected Created, got {:?}", other),
        }

        // --- THEN clause ---
        // get(locator: "./specs/password.concept") -> ok(resource: r, kind: "concept-spec", digest: "abc123")
        let step2 = handler.get(
            GetInput { locator: "./specs/password.concept".to_string() },
            &storage,
        ).await.unwrap();
        match step2 {
            GetOutput::Ok { resource, kind, digest, .. } => {
                assert_eq!(resource, r.clone());
                assert_eq!(kind, "concept-spec".to_string());
                assert_eq!(digest, "abc123".to_string());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
        // upsert(locator: "./specs/password.concept", kind: "concept-spec", digest: "abc123") -> unchanged(resource: r)
        let step3 = handler.upsert(
            UpsertInput { locator: "./specs/password.concept".to_string(), kind: "concept-spec".to_string(), digest: "abc123".to_string() },
            &storage,
        ).await.unwrap();
        match step3 {
            UpsertOutput::Unchanged { resource, .. } => {
                assert_eq!(resource, r.clone());
            },
            other => panic!("Expected Unchanged, got {:?}", other),
        }
        // upsert(locator: "./specs/password.concept", kind: "concept-spec", digest: "def456") -> changed(resource: r, previousDigest: "abc123")
        let step4 = handler.upsert(
            UpsertInput { locator: "./specs/password.concept".to_string(), kind: "concept-spec".to_string(), digest: "def456".to_string() },
            &storage,
        ).await.unwrap();
        match step4 {
            UpsertOutput::Changed { resource, previous_digest, .. } => {
                assert_eq!(resource, r.clone());
                assert_eq!(previous_digest, "abc123".to_string());
            },
            other => panic!("Expected Changed, got {:?}", other),
        }
    }

}
