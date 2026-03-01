// generated: concept_entity/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::ConceptEntityHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn concept_entity_invariant_1() {
        // invariant 1: after register, get behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let e = "u-test-invariant-001".to_string();

        // --- AFTER clause ---
        // register(name: "Article", source: "specs/article.concept", ast: "{}") -> ok(entity: e)
        let step1 = handler.register(
            RegisterInput { name: "Article".to_string(), source: "specs/article.concept".to_string(), ast: "{}".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            RegisterOutput::Ok { entity, .. } => {
                assert_eq!(entity, e.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // get(name: "Article") -> ok(entity: e)
        let step2 = handler.get(
            GetInput { name: "Article".to_string() },
            &storage,
        ).await.unwrap();
        match step2 {
            GetOutput::Ok { entity, .. } => {
                assert_eq!(entity, e.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

    #[tokio::test]
    async fn concept_entity_invariant_2() {
        // invariant 2: after register, register behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let e = "u-test-invariant-001".to_string();

        // --- AFTER clause ---
        // register(name: "Article", source: "specs/article.concept", ast: "{}") -> ok(entity: e)
        let step1 = handler.register(
            RegisterInput { name: "Article".to_string(), source: "specs/article.concept".to_string(), ast: "{}".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            RegisterOutput::Ok { entity, .. } => {
                assert_eq!(entity, e.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // register(name: "Article", source: "specs/article.concept", ast: "{}") -> alreadyRegistered(existing: e)
        let step2 = handler.register(
            RegisterInput { name: "Article".to_string(), source: "specs/article.concept".to_string(), ast: "{}".to_string() },
            &storage,
        ).await.unwrap();
        match step2 {
            RegisterOutput::AlreadyRegistered { existing, .. } => {
                assert_eq!(existing, e.clone());
            },
            other => panic!("Expected AlreadyRegistered, got {:?}", other),
        }
    }

}
