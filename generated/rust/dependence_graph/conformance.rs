// generated: dependence_graph/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::DependenceGraphHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn dependence_graph_invariant_1() {
        // invariant 1: after compute, get behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let n = "u-test-invariant-001".to_string();

        // --- AFTER clause ---
        // compute(scopeRef: "src/handler.ts") -> ok(graph: n)
        let step1 = handler.compute(
            ComputeInput { scope_ref: "src/handler.ts".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            ComputeOutput::Ok { graph, .. } => {
                assert_eq!(graph, n.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // get(graph: n) -> ok(graph: n, scope: "file", nodeCount: _, edgeCount: _)
        let step2 = handler.get(
            GetInput { graph: n.clone() },
            &storage,
        ).await.unwrap();
        match step2 {
            GetOutput::Ok { graph, scope, node_count, edge_count, .. } => {
                assert_eq!(graph, n.clone());
                assert_eq!(scope, "file".to_string());
                assert_eq!(node_count, .clone());
                assert_eq!(edge_count, .clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
