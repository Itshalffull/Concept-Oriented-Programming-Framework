// generated: content_storage/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::ContentStorageHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn content_storage_invariant_1() {
        // invariant 1: after save, load behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let r = "u-test-invariant-001".to_string();

        // --- AFTER clause ---
        // save(record: r, data: "{\"title\":\"Test\"}") -> ok(record: r)
        let step1 = handler.save(
            SaveInput { record: r.clone(), data: "{"title":"Test"}".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            SaveOutput::Ok { record, .. } => {
                assert_eq!(record, r.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // load(record: r) -> ok(record: r, data: "{\"title\":\"Test\"}")
        let step2 = handler.load(
            LoadInput { record: r.clone() },
            &storage,
        ).await.unwrap();
        match step2 {
            LoadOutput::Ok { record, data, .. } => {
                assert_eq!(record, r.clone());
                assert_eq!(data, "{"title":"Test"}".to_string());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

    #[tokio::test]
    async fn content_storage_invariant_2() {
        // invariant 2: after save, delete, load behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let r = "u-test-invariant-001".to_string();

        // --- AFTER clause ---
        // save(record: r, data: "{\"title\":\"Test\"}") -> ok(record: r)
        let step1 = handler.save(
            SaveInput { record: r.clone(), data: "{"title":"Test"}".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            SaveOutput::Ok { record, .. } => {
                assert_eq!(record, r.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
        // delete(record: r) -> ok(record: r)
        let step2 = handler.delete(
            DeleteInput { record: r.clone() },
            &storage,
        ).await.unwrap();
        match step2 {
            DeleteOutput::Ok { record, .. } => {
                assert_eq!(record, r.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // load(record: r) -> notfound(message: "not found")
        let step3 = handler.load(
            LoadInput { record: r.clone() },
            &storage,
        ).await.unwrap();
        match step3 {
            LoadOutput::Notfound { message, .. } => {
                assert_eq!(message, "not found".to_string());
            },
            other => panic!("Expected Notfound, got {:?}", other),
        }
    }

}
