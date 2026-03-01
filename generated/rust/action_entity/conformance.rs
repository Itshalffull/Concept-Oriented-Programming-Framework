// generated: action_entity/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::ActionEntityHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn action_entity_invariant_1() {
        // invariant 1: after register, get behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let a = "u-test-invariant-001".to_string();

        // --- AFTER clause ---
        // register(concept: "Article", name: "create", params: "[]", variantRefs: "[]") -> ok(action: a)
        let step1 = handler.register(
            RegisterInput { concept: "Article".to_string(), name: "create".to_string(), params: "[]".to_string(), variant_refs: "[]".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            RegisterOutput::Ok { action, .. } => {
                assert_eq!(action, a.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // get(action: a) -> ok(action: a, concept: "Article", name: "create", params: "[]", variantCount: 0)
        let step2 = handler.get(
            GetInput { action: a.clone() },
            &storage,
        ).await.unwrap();
        match step2 {
            GetOutput::Ok { action, concept, name, params, variant_count, .. } => {
                assert_eq!(action, a.clone());
                assert_eq!(concept, "Article".to_string());
                assert_eq!(name, "create".to_string());
                assert_eq!(params, "[]".to_string());
                assert_eq!(variant_count, 0);
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
