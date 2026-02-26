// generated: outline/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::OutlineHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn outline_invariant_1() {
        // invariant 1: after create, collapse, expand behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let x = "u-test-invariant-001".to_string();

        // --- AFTER clause ---
        // create(node: x) -> ok(node: x)
        let step1 = handler.create(
            CreateInput { node: x.clone() },
            &storage,
        ).await.unwrap();
        match step1 {
            CreateOutput::Ok { node, .. } => {
                assert_eq!(node, x.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
        // collapse(node: x) -> ok(node: x)
        let step2 = handler.collapse(
            CollapseInput { node: x.clone() },
            &storage,
        ).await.unwrap();
        match step2 {
            CollapseOutput::Ok { node, .. } => {
                assert_eq!(node, x.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // expand(node: x) -> ok(node: x)
        let step3 = handler.expand(
            ExpandInput { node: x.clone() },
            &storage,
        ).await.unwrap();
        match step3 {
            ExpandOutput::Ok { node, .. } => {
                assert_eq!(node, x.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
