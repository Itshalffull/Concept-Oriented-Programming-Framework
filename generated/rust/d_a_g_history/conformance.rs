// generated: d_a_g_history/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::DAGHistoryHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn d_a_g_history_invariant_1() {
        // invariant 1: after append, getNode behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let n = "u-test-invariant-001".to_string();

        // --- AFTER clause ---
        // append(parents: "[]", contentRef: "abc123", metadata: "") -> ok(nodeId: n)
        let step1 = handler.append(
            AppendInput { parents: "[]".to_string(), content_ref: "abc123".to_string(), metadata: "".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            AppendOutput::Ok { node_id, .. } => {
                assert_eq!(node_id, n.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // getNode(nodeId: n) -> ok(parents: "[]", contentRef: "abc123", metadata: "")
        let step2 = handler.get_node(
            GetNodeInput { node_id: n.clone() },
            &storage,
        ).await.unwrap();
        match step2 {
            GetNodeOutput::Ok { parents, content_ref, metadata, .. } => {
                assert_eq!(parents, "[]".to_string());
                assert_eq!(content_ref, "abc123".to_string());
                assert_eq!(metadata, "".to_string());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

    #[tokio::test]
    async fn d_a_g_history_invariant_2() {
        // invariant 2: after append, ancestors behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let n = "u-test-invariant-001".to_string();
        let path = "u-test-invariant-002".to_string();

        // --- AFTER clause ---
        // append(parents: "[p1]", contentRef: "def456", metadata: "") -> ok(nodeId: n)
        let step1 = handler.append(
            AppendInput { parents: "[p1]".to_string(), content_ref: "def456".to_string(), metadata: "".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            AppendOutput::Ok { node_id, .. } => {
                assert_eq!(node_id, n.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // ancestors(nodeId: n) -> ok(nodes: path)
        let step2 = handler.ancestors(
            AncestorsInput { node_id: n.clone() },
            &storage,
        ).await.unwrap();
        match step2 {
            AncestorsOutput::Ok { nodes, .. } => {
                assert_eq!(nodes, path.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
