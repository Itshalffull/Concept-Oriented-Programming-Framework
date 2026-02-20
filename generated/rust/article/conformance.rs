// generated: article/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::ArticleHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn article_invariant_1() {
        // invariant 1: after create, get behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let a = "u-test-invariant-001".to_string();

        // --- AFTER clause ---
        // create(article: a, title: "Test Article", description: "A test", body: "Body text", author: "u1") -> ok(article: a)
        let step1 = handler.create(
            CreateInput { article: a.clone(), title: "Test Article".to_string(), description: "A test".to_string(), body: "Body text".to_string(), author: "u1".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            CreateOutput::Ok { article, .. } => {
                assert_eq!(article, a.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // get(article: a) -> ok(article: a, slug: "test-article", title: "Test Article", description: "A test", body: "Body text", author: "u1")
        let step2 = handler.get(
            GetInput { article: a.clone() },
            &storage,
        ).await.unwrap();
        match step2 {
            GetOutput::Ok { article, slug, title, description, body, author, .. } => {
                assert_eq!(article, a.clone());
                assert_eq!(slug, "test-article".to_string());
                assert_eq!(title, "Test Article".to_string());
                assert_eq!(description, "A test".to_string());
                assert_eq!(body, "Body text".to_string());
                assert_eq!(author, "u1".to_string());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

    #[tokio::test]
    async fn article_invariant_2() {
        // invariant 2: after create, delete behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let a = "u-test-invariant-001".to_string();

        // --- AFTER clause ---
        // create(article: a, title: "To Delete", description: "Desc", body: "Body", author: "u1") -> ok(article: a)
        let step1 = handler.create(
            CreateInput { article: a.clone(), title: "To Delete".to_string(), description: "Desc".to_string(), body: "Body".to_string(), author: "u1".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            CreateOutput::Ok { article, .. } => {
                assert_eq!(article, a.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // delete(article: a) -> ok(article: a)
        let step2 = handler.delete(
            DeleteInput { article: a.clone() },
            &storage,
        ).await.unwrap();
        match step2 {
            DeleteOutput::Ok { article, .. } => {
                assert_eq!(article, a.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
