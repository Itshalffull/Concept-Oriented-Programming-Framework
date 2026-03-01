// generated: env/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::EnvHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn env_invariant_1() {
        // invariant 1: after resolve, promote behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let e = "u-test-invariant-001".to_string();
        let r = "u-test-invariant-002".to_string();
        let e2 = "u-test-invariant-003".to_string();

        // --- AFTER clause ---
        // resolve(environment: e) -> ok(environment: e, resolved: r)
        let step1 = handler.resolve(
            ResolveInput { environment: e.clone() },
            &storage,
        ).await.unwrap();
        match step1 {
            ResolveOutput::Ok { environment, resolved, .. } => {
                assert_eq!(environment, e.clone());
                assert_eq!(resolved, r.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // promote(fromEnv: e, toEnv: e2, kitName: "auth") -> ok(toEnv: e2, version: "1.0.0")
        let step2 = handler.promote(
            PromoteInput { from_env: e.clone(), to_env: e2.clone(), kit_name: "auth".to_string() },
            &storage,
        ).await.unwrap();
        match step2 {
            PromoteOutput::Ok { to_env, version, .. } => {
                assert_eq!(to_env, e2.clone());
                assert_eq!(version, "1.0.0".to_string());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
