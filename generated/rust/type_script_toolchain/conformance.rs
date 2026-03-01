// generated: type_script_toolchain/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::TypeScriptToolchainHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn type_script_toolchain_invariant_1() {
        // invariant 1: after resolve, register behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let n = "u-test-invariant-001".to_string();
        let caps = "u-test-invariant-002".to_string();

        // --- AFTER clause ---
        // resolve(platform: "node-20", versionConstraint: ">=5.7") -> ok(toolchain: n, tscPath: "/usr/local/bin/tsc", version: "5.7.2", capabilities: ["esm", "declaration-maps"])
        let step1 = handler.resolve(
            ResolveInput { platform: "node-20".to_string(), version_constraint: ">=5.7".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            ResolveOutput::Ok { toolchain, tsc_path, version, capabilities, .. } => {
                assert_eq!(toolchain, n.clone());
                assert_eq!(tsc_path, "/usr/local/bin/tsc".to_string());
                assert_eq!(version, "5.7.2".to_string());
                assert_eq!(capabilities, todo!(/* list: ["esm".to_string(), "declaration-maps".to_string()] */));
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // register() -> ok(name: "TypeScriptToolchain", language: "typescript", capabilities: caps)
        let step2 = handler.register(
            RegisterInput {  },
            &storage,
        ).await.unwrap();
        match step2 {
            RegisterOutput::Ok { name, language, capabilities, .. } => {
                assert_eq!(name, "TypeScriptToolchain".to_string());
                assert_eq!(language, "typescript".to_string());
                assert_eq!(capabilities, caps.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
