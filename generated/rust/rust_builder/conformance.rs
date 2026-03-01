// generated: rust_builder/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::RustBuilderHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn rust_builder_invariant_1() {
        // invariant 1: after build, test behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let r = "u-test-invariant-001".to_string();
        let null = "u-test-invariant-002".to_string();

        // --- AFTER clause ---
        // build(source: "./generated/rust/password", toolchainPath: "/usr/local/bin/rustc", platform: "linux-x86_64", config: { mode: "release" }) -> ok(build: r, artifactPath: ".clef-artifacts/rust/password", artifactHash: "sha256:ghi")
        let step1 = handler.build(
            BuildInput { source: "./generated/rust/password".to_string(), toolchain_path: "/usr/local/bin/rustc".to_string(), platform: "linux-x86_64".to_string(), config: todo!(/* record: { "mode": "release".to_string() } */) },
            &storage,
        ).await.unwrap();
        match step1 {
            BuildOutput::Ok { build, artifact_path, artifact_hash, .. } => {
                assert_eq!(build, r.clone());
                assert_eq!(artifact_path, ".clef-artifacts/rust/password".to_string());
                assert_eq!(artifact_hash, "sha256:ghi".to_string());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // test(build: r, toolchainPath: "/usr/local/bin/rustc", invocation: { command: "cargo test", args: ["--", "--format=json"], outputFormat: "cargo-test-json", configFile: "Cargo.toml", env: null }, testType: "unit") -> ok(passed: 15, failed: 0, skipped: 0, duration: 2100, testType: "unit")
        let step2 = handler.test(
            TestInput { build: r.clone(), toolchain_path: "/usr/local/bin/rustc".to_string(), invocation: todo!(/* record: { "command": "cargo test".to_string(), "args": todo!(/* list: ["--".to_string(), "--format=json".to_string()] */), "outputFormat": "cargo-test-json".to_string(), "configFile": "Cargo.toml".to_string(), "env": null.clone() } */), test_type: "unit".to_string() },
            &storage,
        ).await.unwrap();
        match step2 {
            TestOutput::Ok { passed, failed, skipped, duration, test_type, .. } => {
                assert_eq!(passed, 15);
                assert_eq!(failed, 0);
                assert_eq!(skipped, 0);
                assert_eq!(duration, 2100);
                assert_eq!(test_type, "unit".to_string());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
