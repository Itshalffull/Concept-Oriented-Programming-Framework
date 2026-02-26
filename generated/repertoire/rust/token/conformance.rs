// generated: token/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::TokenHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn token_invariant_1() {
        // invariant 1: after registerProvider, replace behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let t = "u-test-invariant-001".to_string();

        // --- AFTER clause ---
        // registerProvider(token: t, provider: "userMailProvider") -> ok()
        let step1 = handler.register_provider(
            RegisterProviderInput { token: t.clone(), provider: "userMailProvider".to_string() },
            &storage,
        ).await.unwrap();
        assert!(matches!(step1, RegisterProviderOutput::Ok));

        // --- THEN clause ---
        // replace(text: "Contact [user:mail]", context: "user") -> ok(result: "Contact user@example.com")
        let step2 = handler.replace(
            ReplaceInput { text: "Contact [user:mail]".to_string(), context: "user".to_string() },
            &storage,
        ).await.unwrap();
        match step2 {
            ReplaceOutput::Ok { result, .. } => {
                assert_eq!(result, "Contact user@example.com".to_string());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
