// generated: design_token/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::DesignTokenHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn design_token_invariant_1() {
        // invariant 1: after define, resolve behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let t = "u-test-invariant-001".to_string();

        // --- AFTER clause ---
        // define(token: t, name: "blue-500", value: "#3b82f6", type: "color", tier: "primitive") -> ok(token: t)
        let step1 = handler.define(
            DefineInput { token: t.clone(), name: "blue-500".to_string(), value: "#3b82f6".to_string(), type: "color".to_string(), tier: "primitive".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            DefineOutput::Ok { token, .. } => {
                assert_eq!(token, t.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // resolve(token: t) -> ok(token: t, resolvedValue: "#3b82f6")
        let step2 = handler.resolve(
            ResolveInput { token: t.clone() },
            &storage,
        ).await.unwrap();
        match step2 {
            ResolveOutput::Ok { token, resolved_value, .. } => {
                assert_eq!(token, t.clone());
                assert_eq!(resolved_value, "#3b82f6".to_string());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
