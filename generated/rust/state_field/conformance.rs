// generated: state_field/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::StateFieldHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn state_field_invariant_1() {
        // invariant 1: after register, get behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let l = "u-test-invariant-001".to_string();

        // --- AFTER clause ---
        // register(concept: "Article", name: "title", typeExpr: "T -> String") -> ok(field: l)
        let step1 = handler.register(
            RegisterInput { concept: "Article".to_string(), name: "title".to_string(), type_expr: "T -> String".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            RegisterOutput::Ok { field, .. } => {
                assert_eq!(field, l.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // get(field: l) -> ok(field: l, concept: "Article", name: "title", typeExpr: "T -> String", cardinality: "mapping")
        let step2 = handler.get(
            GetInput { field: l.clone() },
            &storage,
        ).await.unwrap();
        match step2 {
            GetOutput::Ok { field, concept, name, type_expr, cardinality, .. } => {
                assert_eq!(field, l.clone());
                assert_eq!(concept, "Article".to_string());
                assert_eq!(name, "title".to_string());
                assert_eq!(type_expr, "T -> String".to_string());
                assert_eq!(cardinality, "mapping".to_string());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
