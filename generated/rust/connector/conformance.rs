// generated: connector/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::ConnectorHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn connector_invariant_1() {
        // invariant 1: after configure, test, read behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        // --- AFTER clause ---
        // configure(sourceId: "src-1", protocolId: "rest", config: "{\"baseUrl\":\"https://api.example.com\"}") -> ok(connectorId: "conn-1")
        let step1 = handler.configure(
            ConfigureInput { source_id: "src-1".to_string(), protocol_id: "rest".to_string(), config: "{"baseUrl":"https://api.example.com"}".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            ConfigureOutput::Ok { connector_id, .. } => {
                assert_eq!(connector_id, "conn-1".to_string());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // test(connectorId: "conn-1") -> ok(message: "connected")
        let step2 = handler.test(
            TestInput { connector_id: "conn-1".to_string() },
            &storage,
        ).await.unwrap();
        match step2 {
            TestOutput::Ok { message, .. } => {
                assert_eq!(message, "connected".to_string());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
        // read(connectorId: "conn-1", query: "{\"path\":\"/posts\"}", options: "{}") -> ok(data: "[{\"id\":1}]")
        let step3 = handler.read(
            ReadInput { connector_id: "conn-1".to_string(), query: "{"path":"/posts"}".to_string(), options: "{}".to_string() },
            &storage,
        ).await.unwrap();
        match step3 {
            ReadOutput::Ok { data, .. } => {
                assert_eq!(data, "[{"id":1}]".to_string());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
