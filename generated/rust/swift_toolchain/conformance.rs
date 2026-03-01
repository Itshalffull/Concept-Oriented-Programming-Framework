// generated: swift_toolchain/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::SwiftToolchainHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn swift_toolchain_invariant_1() {
        // invariant 1: after resolve, register behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let s = "u-test-invariant-001".to_string();
        let caps = "u-test-invariant-002".to_string();

        // --- AFTER clause ---
        // resolve(platform: "linux-arm64", versionConstraint: ">=5.10") -> ok(toolchain: s, swiftcPath: "/usr/bin/swiftc", version: "5.10.1", capabilities: ["macros", "swift-testing"])
        let step1 = handler.resolve(
            ResolveInput { platform: "linux-arm64".to_string(), version_constraint: ">=5.10".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            ResolveOutput::Ok { toolchain, swiftc_path, version, capabilities, .. } => {
                assert_eq!(toolchain, s.clone());
                assert_eq!(swiftc_path, "/usr/bin/swiftc".to_string());
                assert_eq!(version, "5.10.1".to_string());
                assert_eq!(capabilities, todo!(/* list: ["macros".to_string(), "swift-testing".to_string()] */));
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // register() -> ok(name: "SwiftToolchain", language: "swift", capabilities: caps)
        let step2 = handler.register(
            RegisterInput {  },
            &storage,
        ).await.unwrap();
        match step2 {
            RegisterOutput::Ok { name, language, capabilities, .. } => {
                assert_eq!(name, "SwiftToolchain".to_string());
                assert_eq!(language, "swift".to_string());
                assert_eq!(capabilities, caps.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
