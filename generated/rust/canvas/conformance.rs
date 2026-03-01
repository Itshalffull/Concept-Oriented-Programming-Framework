// generated: canvas/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::CanvasHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn canvas_invariant_1() {
        // invariant 1: after addNode, moveNode behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let v = "u-test-invariant-001".to_string();

        // --- AFTER clause ---
        // addNode(canvas: v, node: "a", x: 0, y: 0) -> ok()
        let step1 = handler.add_node(
            AddNodeInput { canvas: v.clone(), node: "a".to_string(), x: 0, y: 0 },
            &storage,
        ).await.unwrap();
        assert!(matches!(step1, AddNodeOutput::Ok));

        // --- THEN clause ---
        // moveNode(canvas: v, node: "a", x: 100, y: 200) -> ok()
        let step2 = handler.move_node(
            MoveNodeInput { canvas: v.clone(), node: "a".to_string(), x: 100, y: 200 },
            &storage,
        ).await.unwrap();
        assert!(matches!(step2, MoveNodeOutput::Ok));
    }

}
