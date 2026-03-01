// generated: annotation/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::AnnotationHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn annotation_invariant_1() {
        // invariant 1: after annotate, resolve behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let n = "u-test-invariant-001".to_string();
        let a = "u-test-invariant-002".to_string();

        // --- AFTER clause ---
        // annotate(concept: "SpecParser", scope: "concept", content: "{\"tool-permissions\":[\"Read\",\"Bash\"],\"custom-field\":\"anything\"}") -> ok(annotation: n, keyCount: 2)
        let step1 = handler.annotate(
            AnnotateInput { concept: "SpecParser".to_string(), scope: "concept".to_string(), content: "{"tool-permissions":["Read","Bash"],"custom-field":"anything"}".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            AnnotateOutput::Ok { annotation, key_count, .. } => {
                assert_eq!(annotation, n.clone());
                assert_eq!(key_count, 2);
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // resolve(concept: "SpecParser") -> ok(annotations: a)
        let step2 = handler.resolve(
            ResolveInput { concept: "SpecParser".to_string() },
            &storage,
        ).await.unwrap();
        match step2 {
            ResolveOutput::Ok { annotations, .. } => {
                assert_eq!(annotations, a.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
