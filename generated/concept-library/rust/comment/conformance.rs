// generated: comment/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::CommentHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn comment_invariant_1() {
        // invariant 1: after addComment, reply behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let c = "u-test-invariant-001".to_string();
        let e = "u-test-invariant-002".to_string();
        let r = "u-test-invariant-003".to_string();

        // --- AFTER clause ---
        // addComment(comment: c, entity: e, content: "Hello", author: "alice") -> ok(comment: c)
        let step1 = handler.add_comment(
            AddCommentInput { comment: c.clone(), entity: e.clone(), content: "Hello".to_string(), author: "alice".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            AddCommentOutput::Ok { comment, .. } => {
                assert_eq!(comment, c.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // reply(comment: r, parent: c, content: "Reply", author: "bob") -> ok(comment: r)
        let step2 = handler.reply(
            ReplyInput { comment: r.clone(), parent: c.clone(), content: "Reply".to_string(), author: "bob".to_string() },
            &storage,
        ).await.unwrap();
        match step2 {
            ReplyOutput::Ok { comment, .. } => {
                assert_eq!(comment, r.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
