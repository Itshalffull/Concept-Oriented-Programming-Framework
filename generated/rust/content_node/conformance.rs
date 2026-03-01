// generated: content_node/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::ContentNodeHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn content_node_invariant_1() {
        // invariant 1: after create, get behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let x = "u-test-invariant-001".to_string();

        // --- AFTER clause ---
        // create(node: x, type: "page", content: "Hello", createdBy: "user1") -> ok(node: x)
        let step1 = handler.create(
            CreateInput { node: x.clone(), type: "page".to_string(), content: "Hello".to_string(), created_by: "user1".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            CreateOutput::Ok { node, .. } => {
                assert_eq!(node, x.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // get(node: x) -> ok(node: x, type: "page", content: "Hello", metadata: "")
        let step2 = handler.get(
            GetInput { node: x.clone() },
            &storage,
        ).await.unwrap();
        match step2 {
            GetOutput::Ok { node, type, content, metadata, .. } => {
                assert_eq!(node, x.clone());
                assert_eq!(type, "page".to_string());
                assert_eq!(content, "Hello".to_string());
                assert_eq!(metadata, "".to_string());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

    #[tokio::test]
    async fn content_node_invariant_2() {
        // invariant 2: after create, create behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let x = "u-test-invariant-001".to_string();

        // --- AFTER clause ---
        // create(node: x, type: "page", content: "Hello", createdBy: "user1") -> ok(node: x)
        let step1 = handler.create(
            CreateInput { node: x.clone(), type: "page".to_string(), content: "Hello".to_string(), created_by: "user1".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            CreateOutput::Ok { node, .. } => {
                assert_eq!(node, x.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // create(node: x, type: "page", content: "Again", createdBy: "user2") -> exists(message: "already exists")
        let step2 = handler.create(
            CreateInput { node: x.clone(), type: "page".to_string(), content: "Again".to_string(), created_by: "user2".to_string() },
            &storage,
        ).await.unwrap();
        match step2 {
            CreateOutput::Exists { message, .. } => {
                assert_eq!(message, "already exists".to_string());
            },
            other => panic!("Expected Exists, got {:?}", other),
        }
    }

}
