// generated: graph/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::GraphHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn graph_invariant_1() {
        // invariant 1: after addNode, addNode, addEdge, getNeighbors behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let g = "u-test-invariant-001".to_string();

        // --- AFTER clause ---
        // addNode(graph: g, node: "A") -> ok()
        let step1 = handler.add_node(
            AddNodeInput { graph: g.clone(), node: "A".to_string() },
            &storage,
        ).await.unwrap();
        assert!(matches!(step1, AddNodeOutput::Ok));

        // --- THEN clause ---
        // addNode(graph: g, node: "B") -> ok()
        let step2 = handler.add_node(
            AddNodeInput { graph: g.clone(), node: "B".to_string() },
            &storage,
        ).await.unwrap();
        assert!(matches!(step2, AddNodeOutput::Ok));
        // addEdge(graph: g, source: "A", target: "B") -> ok()
        let step3 = handler.add_edge(
            AddEdgeInput { graph: g.clone(), source: "A".to_string(), target: "B".to_string() },
            &storage,
        ).await.unwrap();
        assert!(matches!(step3, AddEdgeOutput::Ok));
        // getNeighbors(graph: g, node: "A", depth: 1) -> ok(neighbors: "B")
        let step4 = handler.get_neighbors(
            GetNeighborsInput { graph: g.clone(), node: "A".to_string(), depth: 1 },
            &storage,
        ).await.unwrap();
        match step4 {
            GetNeighborsOutput::Ok { neighbors, .. } => {
                assert_eq!(neighbors, "B".to_string());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
