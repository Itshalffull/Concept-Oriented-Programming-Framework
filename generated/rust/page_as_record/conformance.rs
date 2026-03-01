// generated: page_as_record/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::PageAsRecordHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn page_as_record_invariant_1() {
        // invariant 1: after create, setProperty, getProperty behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let p = "u-test-invariant-001".to_string();

        // --- AFTER clause ---
        // create(page: p, schema: "{\"fields\":[\"title\"]}") -> ok(page: p)
        let step1 = handler.create(
            CreateInput { page: p.clone(), schema: "{"fields":["title"]}".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            CreateOutput::Ok { page, .. } => {
                assert_eq!(page, p.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
        // setProperty(page: p, key: "title", value: "My Page") -> ok(page: p)
        let step2 = handler.set_property(
            SetPropertyInput { page: p.clone(), key: "title".to_string(), value: "My Page".to_string() },
            &storage,
        ).await.unwrap();
        match step2 {
            SetPropertyOutput::Ok { page, .. } => {
                assert_eq!(page, p.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // getProperty(page: p, key: "title") -> ok(value: "My Page")
        let step3 = handler.get_property(
            GetPropertyInput { page: p.clone(), key: "title".to_string() },
            &storage,
        ).await.unwrap();
        match step3 {
            GetPropertyOutput::Ok { value, .. } => {
                assert_eq!(value, "My Page".to_string());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
