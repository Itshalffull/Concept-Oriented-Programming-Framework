// generated: solidity_toolchain/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::SolidityToolchainHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn solidity_toolchain_invariant_1() {
        // invariant 1: after resolve, register behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let l = "u-test-invariant-001".to_string();
        let caps = "u-test-invariant-002".to_string();

        // --- AFTER clause ---
        // resolve(platform: "evm-shanghai", versionConstraint: ">=0.8.20") -> ok(toolchain: l, solcPath: "/usr/local/bin/solc", version: "0.8.25", capabilities: ["optimizer", "via-ir"])
        let step1 = handler.resolve(
            ResolveInput { platform: "evm-shanghai".to_string(), version_constraint: ">=0.8.20".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            ResolveOutput::Ok { toolchain, solc_path, version, capabilities, .. } => {
                assert_eq!(toolchain, l.clone());
                assert_eq!(solc_path, "/usr/local/bin/solc".to_string());
                assert_eq!(version, "0.8.25".to_string());
                assert_eq!(capabilities, todo!(/* list: ["optimizer".to_string(), "via-ir".to_string()] */));
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // register() -> ok(name: "SolidityToolchain", language: "solidity", capabilities: caps)
        let step2 = handler.register(
            RegisterInput {  },
            &storage,
        ).await.unwrap();
        match step2 {
            RegisterOutput::Ok { name, language, capabilities, .. } => {
                assert_eq!(name, "SolidityToolchain".to_string());
                assert_eq!(language, "solidity".to_string());
                assert_eq!(capabilities, caps.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
