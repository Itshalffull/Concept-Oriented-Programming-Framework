// generated: element/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::ElementHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn element_invariant_1() {
        // invariant 1: after create, enrich behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let e = "u-test-invariant-001".to_string();

        // --- AFTER clause ---
        // create(element: e, kind: "input-text", label: "Title", dataType: "String") -> ok(element: e)
        let step1 = handler.create(
            CreateInput { element: e.clone(), kind: "input-text".to_string(), label: "Title".to_string(), data_type: "String".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            CreateOutput::Ok { element, .. } => {
                assert_eq!(element, e.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // enrich(element: e, interactorType: "text-short", interactorProps: "{}") -> ok(element: e)
        let step2 = handler.enrich(
            EnrichInput { element: e.clone(), interactor_type: "text-short".to_string(), interactor_props: "{}".to_string() },
            &storage,
        ).await.unwrap();
        match step2 {
            EnrichOutput::Ok { element, .. } => {
                assert_eq!(element, e.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
