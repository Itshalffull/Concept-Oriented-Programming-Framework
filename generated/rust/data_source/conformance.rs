// generated: data_source/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::DataSourceHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn data_source_invariant_1() {
        // invariant 1: after register, connect, discover behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        // --- AFTER clause ---
        // register(name: "blog_api", uri: "https://blog.example.com/api", credentials: "token:abc") -> ok(sourceId: "src-1")
        let step1 = handler.register(
            RegisterInput { name: "blog_api".to_string(), uri: "https://blog.example.com/api".to_string(), credentials: "token:abc".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            RegisterOutput::Ok { source_id, .. } => {
                assert_eq!(source_id, "src-1".to_string());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // connect(sourceId: "src-1") -> ok(message: "connected")
        let step2 = handler.connect(
            ConnectInput { source_id: "src-1".to_string() },
            &storage,
        ).await.unwrap();
        match step2 {
            ConnectOutput::Ok { message, .. } => {
                assert_eq!(message, "connected".to_string());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
        // discover(sourceId: "src-1") -> ok(rawSchema: "{\"streams\":[\"posts\",\"authors\"]}")
        let step3 = handler.discover(
            DiscoverInput { source_id: "src-1".to_string() },
            &storage,
        ).await.unwrap();
        match step3 {
            DiscoverOutput::Ok { raw_schema, .. } => {
                assert_eq!(raw_schema, "{"streams":["posts","authors"]}".to_string());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
