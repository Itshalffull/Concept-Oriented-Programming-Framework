// generated: property/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::PropertyHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn property_invariant_1() {
        // invariant 1: after set, get behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let e = "u-test-invariant-001".to_string();

        // --- AFTER clause ---
        // set(entity: e, key: "title", value: "Hello World") -> ok(entity: e)
        let step1 = handler.set(
            SetInput { entity: e.clone(), key: "title".to_string(), value: "Hello World".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            SetOutput::Ok { entity, .. } => {
                assert_eq!(entity, e.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // get(entity: e, key: "title") -> ok(value: "Hello World")
        let step2 = handler.get(
            GetInput { entity: e.clone(), key: "title".to_string() },
            &storage,
        ).await.unwrap();
        match step2 {
            GetOutput::Ok { value, .. } => {
                assert_eq!(value, "Hello World".to_string());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

    #[tokio::test]
    async fn property_invariant_2() {
        // invariant 2: after set, delete, get behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let e = "u-test-invariant-001".to_string();

        // --- AFTER clause ---
        // set(entity: e, key: "title", value: "Hello") -> ok(entity: e)
        let step1 = handler.set(
            SetInput { entity: e.clone(), key: "title".to_string(), value: "Hello".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            SetOutput::Ok { entity, .. } => {
                assert_eq!(entity, e.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
        // delete(entity: e, key: "title") -> ok(entity: e)
        let step2 = handler.delete(
            DeleteInput { entity: e.clone(), key: "title".to_string() },
            &storage,
        ).await.unwrap();
        match step2 {
            DeleteOutput::Ok { entity, .. } => {
                assert_eq!(entity, e.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // get(entity: e, key: "title") -> notfound(message: "not found")
        let step3 = handler.get(
            GetInput { entity: e.clone(), key: "title".to_string() },
            &storage,
        ).await.unwrap();
        match step3 {
            GetOutput::Notfound { message, .. } => {
                assert_eq!(message, "not found".to_string());
            },
            other => panic!("Expected Notfound, got {:?}", other),
        }
    }

}
