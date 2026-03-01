// generated: scope_graph/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::ScopeGraphHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn scope_graph_invariant_1() {
        // invariant 1: after build, get behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let g = "u-test-invariant-001".to_string();

        // --- AFTER clause ---
        // build(file: "src/handler.ts", tree: "tree-123") -> ok(graph: g)
        let step1 = handler.build(
            BuildInput { file: "src/handler.ts".to_string(), tree: "tree-123".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            BuildOutput::Ok { graph, .. } => {
                assert_eq!(graph, g.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // get(graph: g) -> ok(graph: g, file: "src/handler.ts", scopeCount: _, declarationCount: _, unresolvedCount: _)
        let step2 = handler.get(
            GetInput { graph: g.clone() },
            &storage,
        ).await.unwrap();
        match step2 {
            GetOutput::Ok { graph, file, scope_count, declaration_count, unresolved_count, .. } => {
                assert_eq!(graph, g.clone());
                assert_eq!(file, "src/handler.ts".to_string());
                assert_eq!(scope_count, .clone());
                assert_eq!(declaration_count, .clone());
                assert_eq!(unresolved_count, .clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
