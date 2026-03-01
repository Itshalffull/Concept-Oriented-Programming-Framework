// generated: secret/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::SecretHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn secret_invariant_1() {
        // invariant 1: after resolve, exists behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let s = "u-test-invariant-001".to_string();

        // --- AFTER clause ---
        // resolve(name: "DB_PASSWORD", provider: "vault") -> ok(secret: s, version: "v1")
        let step1 = handler.resolve(
            ResolveInput { name: "DB_PASSWORD".to_string(), provider: "vault".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            ResolveOutput::Ok { secret, version, .. } => {
                assert_eq!(secret, s.clone());
                assert_eq!(version, "v1".to_string());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // exists(name: "DB_PASSWORD", provider: "vault") -> ok(name: "DB_PASSWORD", exists: true)
        let step2 = handler.exists(
            ExistsInput { name: "DB_PASSWORD".to_string(), provider: "vault".to_string() },
            &storage,
        ).await.unwrap();
        match step2 {
            ExistsOutput::Ok { name, exists, .. } => {
                assert_eq!(name, "DB_PASSWORD".to_string());
                assert_eq!(exists, true);
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
