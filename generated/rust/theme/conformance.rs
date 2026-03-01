// generated: theme/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::ThemeHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn theme_invariant_1() {
        // invariant 1: after create, activate, resolve behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let h = "u-test-invariant-001".to_string();

        // --- AFTER clause ---
        // create(theme: h, name: "dark", overrides: "{ \"color-bg\": \"#1a1a1a\" }") -> ok(theme: h)
        let step1 = handler.create(
            CreateInput { theme: h.clone(), name: "dark".to_string(), overrides: "{ "color-bg": "#1a1a1a" }".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            CreateOutput::Ok { theme, .. } => {
                assert_eq!(theme, h.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // activate(theme: h, priority: 1) -> ok(theme: h)
        let step2 = handler.activate(
            ActivateInput { theme: h.clone(), priority: 1 },
            &storage,
        ).await.unwrap();
        match step2 {
            ActivateOutput::Ok { theme, .. } => {
                assert_eq!(theme, h.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
        // resolve(theme: h) -> ok(tokens: _)
        let step3 = handler.resolve(
            ResolveInput { theme: h.clone() },
            &storage,
        ).await.unwrap();
        match step3 {
            ResolveOutput::Ok { tokens, .. } => {
                assert_eq!(tokens, .clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
