// generated: comment/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::CommentHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn comment_invariant_1() {
        // invariant 1: after create, delete behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let c = "u-test-invariant-001".to_string();

        // --- AFTER clause ---
        // create(comment: c, body: "Great post", target: "a1", author: "u1") -> ok(comment: c)
        let step1 = handler.create(
            CreateInput { comment: c.clone(), body: "Great post".to_string(), target: "a1".to_string(), author: "u1".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            CreateOutput::Ok { comment, .. } => {
                assert_eq!(comment, c.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // delete(comment: c) -> ok(comment: c)
        let step2 = handler.delete(
            DeleteInput { comment: c.clone() },
            &storage,
        ).await.unwrap();
        match step2 {
            DeleteOutput::Ok { comment, .. } => {
                assert_eq!(comment, c.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
