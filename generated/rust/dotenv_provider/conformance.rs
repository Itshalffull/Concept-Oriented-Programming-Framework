// generated: dotenv_provider/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::DotenvProviderHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn dotenv_provider_invariant_1() {
        // invariant 1: after fetch, fetch behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let v = "u-test-invariant-001".to_string();

        // --- AFTER clause ---
        // fetch(name: "DB_HOST", filePath: ".env") -> ok(value: v)
        let step1 = handler.fetch(
            FetchInput { name: "DB_HOST".to_string(), file_path: ".env".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            FetchOutput::Ok { value, .. } => {
                assert_eq!(value, v.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // fetch(name: "DB_HOST", filePath: ".env") -> ok(value: v)
        let step2 = handler.fetch(
            FetchInput { name: "DB_HOST".to_string(), file_path: ".env".to_string() },
            &storage,
        ).await.unwrap();
        match step2 {
            FetchOutput::Ok { value, .. } => {
                assert_eq!(value, v.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
