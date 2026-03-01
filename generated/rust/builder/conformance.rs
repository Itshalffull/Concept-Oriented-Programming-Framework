// generated: builder/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::BuilderHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn builder_invariant_1() {
        // invariant 1: after build, status, history behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let b = "u-test-invariant-001".to_string();
        let bs = "u-test-invariant-002".to_string();

        // --- AFTER clause ---
        // build(concept: "password", source: "./generated/swift/password", language: "swift", platform: "linux-arm64", config: { mode: "release" }) -> ok(build: b, artifactHash: "sha256:abc", artifactLocation: ".clef-artifacts/swift/password", duration: 3200)
        let step1 = handler.build(
            BuildInput { concept: "password".to_string(), source: "./generated/swift/password".to_string(), language: "swift".to_string(), platform: "linux-arm64".to_string(), config: todo!(/* record: { "mode": "release".to_string() } */) },
            &storage,
        ).await.unwrap();
        match step1 {
            BuildOutput::Ok { build, artifact_hash, artifact_location, duration, .. } => {
                assert_eq!(build, b.clone());
                assert_eq!(artifact_hash, "sha256:abc".to_string());
                assert_eq!(artifact_location, ".clef-artifacts/swift/password".to_string());
                assert_eq!(duration, 3200);
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // status(build: b) -> ok(build: b, status: "done", duration: 3200)
        let step2 = handler.status(
            StatusInput { build: b.clone() },
            &storage,
        ).await.unwrap();
        match step2 {
            StatusOutput::Ok { build, status, duration, .. } => {
                assert_eq!(build, b.clone());
                assert_eq!(status, "done".to_string());
                assert_eq!(duration, 3200);
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
        // history(concept: "password", language: "swift") -> ok(builds: bs)
        let step3 = handler.history(
            HistoryInput { concept: "password".to_string(), language: "swift".to_string() },
            &storage,
        ).await.unwrap();
        match step3 {
            HistoryOutput::Ok { builds, .. } => {
                assert_eq!(builds, bs.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
