// generated: u_i_schema/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::UISchemaHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn u_i_schema_invariant_1() {
        // invariant 1: after inspect, getElements behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let s = "u-test-invariant-001".to_string();

        // --- AFTER clause ---
        // inspect(schema: s, conceptSpec: "concept Test [T] { state { name: T -> String } }") -> ok(schema: s)
        let step1 = handler.inspect(
            InspectInput { schema: s.clone(), concept_spec: "concept Test [T] { state { name: T -> String } }".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            InspectOutput::Ok { schema, .. } => {
                assert_eq!(schema, s.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // getElements(schema: s) -> ok(elements: _)
        let step2 = handler.get_elements(
            GetElementsInput { schema: s.clone() },
            &storage,
        ).await.unwrap();
        match step2 {
            GetElementsOutput::Ok { elements, .. } => {
                assert_eq!(elements, .clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
