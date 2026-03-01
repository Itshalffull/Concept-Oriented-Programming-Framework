// generated: api_surface/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::ApiSurfaceHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn api_surface_invariant_1() {
        // invariant 1: after compose, entrypoint behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let s = "u-test-invariant-001".to_string();
        let e = "u-test-invariant-002".to_string();
        let c = "u-test-invariant-003".to_string();

        // --- AFTER clause ---
        // compose(kit: "test-kit", target: "rest", outputs: ["todo-output", "user-output"]) -> ok(surface: s, entrypoint: e, conceptCount: 2)
        let step1 = handler.compose(
            ComposeInput { kit: "test-kit".to_string(), target: "rest".to_string(), outputs: todo!(/* list: ["todo-output".to_string(), "user-output".to_string()] */) },
            &storage,
        ).await.unwrap();
        match step1 {
            ComposeOutput::Ok { surface, entrypoint, concept_count, .. } => {
                assert_eq!(surface, s.clone());
                assert_eq!(entrypoint, e.clone());
                assert_eq!(concept_count, 2);
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // entrypoint(surface: s) -> ok(content: c)
        let step2 = handler.entrypoint(
            EntrypointInput { surface: s.clone() },
            &storage,
        ).await.unwrap();
        match step2 {
            EntrypointOutput::Ok { content, .. } => {
                assert_eq!(content, c.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
