// generated: variant_entity/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::VariantEntityHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn variant_entity_invariant_1() {
        // invariant 1: after register, get behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let v = "u-test-invariant-001".to_string();

        // --- AFTER clause ---
        // register(action: "Article/create", tag: "ok", fields: "[]") -> ok(variant: v)
        let step1 = handler.register(
            RegisterInput { action: "Article/create".to_string(), tag: "ok".to_string(), fields: "[]".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            RegisterOutput::Ok { variant, .. } => {
                assert_eq!(variant, v.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // get(variant: v) -> ok(variant: v, action: "Article/create", tag: "ok", fields: "[]")
        let step2 = handler.get(
            GetInput { variant: v.clone() },
            &storage,
        ).await.unwrap();
        match step2 {
            GetOutput::Ok { variant, action, tag, fields, .. } => {
                assert_eq!(variant, v.clone());
                assert_eq!(action, "Article/create".to_string());
                assert_eq!(tag, "ok".to_string());
                assert_eq!(fields, "[]".to_string());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
