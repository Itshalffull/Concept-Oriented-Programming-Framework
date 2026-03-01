// generated: rust_toolchain/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::RustToolchainHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn rust_toolchain_invariant_1() {
        // invariant 1: after resolve, register behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let r = "u-test-invariant-001".to_string();
        let caps = "u-test-invariant-002".to_string();

        // --- AFTER clause ---
        // resolve(platform: "linux-x86_64", versionConstraint: ">=1.75") -> ok(toolchain: r, rustcPath: "/usr/local/bin/rustc", version: "1.78.0", capabilities: ["incremental", "proc-macros"])
        let step1 = handler.resolve(
            ResolveInput { platform: "linux-x86_64".to_string(), version_constraint: ">=1.75".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            ResolveOutput::Ok { toolchain, rustc_path, version, capabilities, .. } => {
                assert_eq!(toolchain, r.clone());
                assert_eq!(rustc_path, "/usr/local/bin/rustc".to_string());
                assert_eq!(version, "1.78.0".to_string());
                assert_eq!(capabilities, todo!(/* list: ["incremental".to_string(), "proc-macros".to_string()] */));
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // register() -> ok(name: "RustToolchain", language: "rust", capabilities: caps)
        let step2 = handler.register(
            RegisterInput {  },
            &storage,
        ).await.unwrap();
        match step2 {
            RegisterOutput::Ok { name, language, capabilities, .. } => {
                assert_eq!(name, "RustToolchain".to_string());
                assert_eq!(language, "rust".to_string());
                assert_eq!(capabilities, caps.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
