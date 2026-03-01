// generated: enrichment_renderer/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::EnrichmentRendererHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn enrichment_renderer_invariant_1() {
        // invariant 1: after register, render behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let h = "u-test-invariant-001".to_string();
        let o = "u-test-invariant-002".to_string();
        let u = "u-test-invariant-003".to_string();

        // --- AFTER clause ---
        // register(key: "migration-guide", format: "skill-md", order: 75, pattern: "heading-body", template: "{\"heading\":\"Migration Guide\"}") -> ok(handler: h)
        let step1 = handler.register(
            RegisterInput { key: "migration-guide".to_string(), format: "skill-md".to_string(), order: 75, pattern: "heading-body".to_string(), template: "{"heading":"Migration Guide"}".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            RegisterOutput::Ok { handler, .. } => {
                assert_eq!(handler, h.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // render(content: "{\"migration-guide\":{\"heading\":\"Migration Guide\",\"body\":\"Follow these steps...\"}}", format: "skill-md") -> ok(output: o, sectionCount: 1, unhandledKeys: u)
        let step2 = handler.render(
            RenderInput { content: "{"migration-guide":{"heading":"Migration Guide","body":"Follow these steps..."}}".to_string(), format: "skill-md".to_string() },
            &storage,
        ).await.unwrap();
        match step2 {
            RenderOutput::Ok { output, section_count, unhandled_keys, .. } => {
                assert_eq!(output, o.clone());
                assert_eq!(section_count, 1);
                assert_eq!(unhandled_keys, u.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
