// generated: mcp_target/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::McpTargetHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn mcp_target_invariant_1() {
        // invariant 1: after generate, listTools behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let t = "u-test-invariant-001".to_string();
        let f = "u-test-invariant-002".to_string();
        let tl = "u-test-invariant-003".to_string();
        let r = "u-test-invariant-004".to_string();
        let tp = "u-test-invariant-005".to_string();

        // --- AFTER clause ---
        // generate(projection: "agent-projection", config: "{}") -> ok(tools: t, files: f)
        let step1 = handler.generate(
            GenerateInput { projection: "agent-projection".to_string(), config: "{}".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            GenerateOutput::Ok { tools, files, .. } => {
                assert_eq!(tools, t.clone());
                assert_eq!(files, f.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // listTools(concept: "Agent") -> ok(tools: tl, resources: r, templates: tp)
        let step2 = handler.list_tools(
            ListToolsInput { concept: "Agent".to_string() },
            &storage,
        ).await.unwrap();
        match step2 {
            ListToolsOutput::Ok { tools, resources, templates, .. } => {
                assert_eq!(tools, tl.clone());
                assert_eq!(resources, r.clone());
                assert_eq!(templates, tp.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
