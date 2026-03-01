// generated: transport/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::TransportHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn transport_invariant_1() {
        // invariant 1: after configure, fetch behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let p = "u-test-invariant-001".to_string();

        // --- AFTER clause ---
        // configure(transport: p, kind: "rest", baseUrl: "https://api.example.com", auth: _, retryPolicy: _) -> ok(transport: p)
        let step1 = handler.configure(
            ConfigureInput { transport: p.clone(), kind: "rest".to_string(), base_url: "https://api.example.com".to_string(), auth: .clone(), retry_policy: .clone() },
            &storage,
        ).await.unwrap();
        match step1 {
            ConfigureOutput::Ok { transport, .. } => {
                assert_eq!(transport, p.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // fetch(transport: p, query: "{ \"path\": \"/articles\" }") -> ok(transport: p, data: _)
        let step2 = handler.fetch(
            FetchInput { transport: p.clone(), query: "{ "path": "/articles" }".to_string() },
            &storage,
        ).await.unwrap();
        match step2 {
            FetchOutput::Ok { transport, data, .. } => {
                assert_eq!(transport, p.clone());
                assert_eq!(data, .clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
