// generated: transform/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::TransformHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn transform_invariant_1() {
        // invariant 1: after apply, preview behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        // --- AFTER clause ---
        // apply(value: "<p>Hello World</p>", transformId: "html_to_markdown") -> ok(result: "Hello World")
        let step1 = handler.apply(
            ApplyInput { value: "<p>Hello World</p>".to_string(), transform_id: "html_to_markdown".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            ApplyOutput::Ok { result, .. } => {
                assert_eq!(result, "Hello World".to_string());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // preview(value: "test", transformId: "html_to_markdown") -> ok(before: "test", after: "test")
        let step2 = handler.preview(
            PreviewInput { value: "test".to_string(), transform_id: "html_to_markdown".to_string() },
            &storage,
        ).await.unwrap();
        match step2 {
            PreviewOutput::Ok { before, after, .. } => {
                assert_eq!(before, "test".to_string());
                assert_eq!(after, "test".to_string());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

    #[tokio::test]
    async fn transform_invariant_2() {
        // invariant 2: after chain, preview behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        // --- AFTER clause ---
        // chain(value: "Hello World!", transformIds: "slugify,truncate") -> ok(result: "hello-world")
        let step1 = handler.chain(
            ChainInput { value: "Hello World!".to_string(), transform_ids: "slugify,truncate".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            ChainOutput::Ok { result, .. } => {
                assert_eq!(result, "hello-world".to_string());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // preview(value: "hello-world", transformId: "slugify") -> ok(before: "hello-world", after: "hello-world")
        let step2 = handler.preview(
            PreviewInput { value: "hello-world".to_string(), transform_id: "slugify".to_string() },
            &storage,
        ).await.unwrap();
        match step2 {
            PreviewOutput::Ok { before, after, .. } => {
                assert_eq!(before, "hello-world".to_string());
                assert_eq!(after, "hello-world".to_string());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
