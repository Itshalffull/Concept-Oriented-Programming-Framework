// generated: layout/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::LayoutHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn layout_invariant_1() {
        // invariant 1: after create, configure, create behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let y = "u-test-invariant-001".to_string();
        let y2 = "u-test-invariant-002".to_string();

        // --- AFTER clause ---
        // create(layout: y, name: "main", kind: "sidebar") -> ok(layout: y)
        let step1 = handler.create(
            CreateInput { layout: y.clone(), name: "main".to_string(), kind: "sidebar".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            CreateOutput::Ok { layout, .. } => {
                assert_eq!(layout, y.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // configure(layout: y, config: "{ \"direction\": \"row\", \"gap\": \"space-4\" }") -> ok(layout: y)
        let step2 = handler.configure(
            ConfigureInput { layout: y.clone(), config: "{ "direction": "row", "gap": "space-4" }".to_string() },
            &storage,
        ).await.unwrap();
        match step2 {
            ConfigureOutput::Ok { layout, .. } => {
                assert_eq!(layout, y.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
        // create(layout: y2, name: "bad", kind: "nonexistent") -> invalid(message: _)
        let step3 = handler.create(
            CreateInput { layout: y2.clone(), name: "bad".to_string(), kind: "nonexistent".to_string() },
            &storage,
        ).await.unwrap();
        match step3 {
            CreateOutput::Invalid { message, .. } => {
                assert_eq!(message, .clone());
            },
            other => panic!("Expected Invalid, got {:?}", other),
        }
    }

}
