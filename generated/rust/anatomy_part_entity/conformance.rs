// generated: anatomy_part_entity/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::AnatomyPartEntityHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn anatomy_part_entity_invariant_1() {
        // invariant 1: after register, get behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let a = "u-test-invariant-001".to_string();

        // --- AFTER clause ---
        // register(widget: "dialog", name: "root", role: "container", required: "true") -> ok(part: a)
        let step1 = handler.register(
            RegisterInput { widget: "dialog".to_string(), name: "root".to_string(), role: "container".to_string(), required: "true".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            RegisterOutput::Ok { part, .. } => {
                assert_eq!(part, a.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // get(part: a) -> ok(part: a, widget: "dialog", name: "root", semanticRole: "container", required: "true")
        let step2 = handler.get(
            GetInput { part: a.clone() },
            &storage,
        ).await.unwrap();
        match step2 {
            GetOutput::Ok { part, widget, name, semantic_role, required, .. } => {
                assert_eq!(part, a.clone());
                assert_eq!(widget, "dialog".to_string());
                assert_eq!(name, "root".to_string());
                assert_eq!(semantic_role, "container".to_string());
                assert_eq!(required, "true".to_string());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
