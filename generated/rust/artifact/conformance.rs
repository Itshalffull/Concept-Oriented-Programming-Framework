// generated: artifact/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::ArtifactHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn artifact_invariant_1() {
        // invariant 1: after build, resolve behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let d = "u-test-invariant-001".to_string();
        let a = "u-test-invariant-002".to_string();
        let h = "u-test-invariant-003".to_string();
        let loc = "u-test-invariant-004".to_string();

        // --- AFTER clause ---
        // build(concept: "User", spec: "user.concept", implementation: "user.impl.ts", deps: d) -> ok(artifact: a, hash: h, sizeBytes: 1024)
        let step1 = handler.build(
            BuildInput { concept: "User".to_string(), spec: "user.concept".to_string(), implementation: "user.impl.ts".to_string(), deps: d.clone() },
            &storage,
        ).await.unwrap();
        match step1 {
            BuildOutput::Ok { artifact, hash, size_bytes, .. } => {
                assert_eq!(artifact, a.clone());
                assert_eq!(hash, h.clone());
                assert_eq!(size_bytes, 1024);
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // resolve(hash: h) -> ok(artifact: a, location: loc)
        let step2 = handler.resolve(
            ResolveInput { hash: h.clone() },
            &storage,
        ).await.unwrap();
        match step2 {
            ResolveOutput::Ok { artifact, location, .. } => {
                assert_eq!(artifact, a.clone());
                assert_eq!(location, loc.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
