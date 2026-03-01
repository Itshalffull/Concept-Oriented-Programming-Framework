// generated: browser_adapter/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::BrowserAdapterHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn browser_adapter_invariant_1() {
        // invariant 1: after normalize, normalize behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let a = "u-test-invariant-001".to_string();

        // --- AFTER clause ---
        // normalize(adapter: a, props: "{ \"type\": \"navigation\", \"destination\": \"detail\", \"urlPattern\": \"/articles/:id\" }") -> ok(adapter: a, normalized: _)
        let step1 = handler.normalize(
            NormalizeInput { adapter: a.clone(), props: "{ "type": "navigation", "destination": "detail", "urlPattern": "/articles/:id" }".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            NormalizeOutput::Ok { adapter, normalized, .. } => {
                assert_eq!(adapter, a.clone());
                assert_eq!(normalized, .clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // normalize(adapter: a, props: "") -> error(message: _)
        let step2 = handler.normalize(
            NormalizeInput { adapter: a.clone(), props: "".to_string() },
            &storage,
        ).await.unwrap();
        match step2 {
            NormalizeOutput::Error { message, .. } => {
                assert_eq!(message, .clone());
            },
            other => panic!("Expected Error, got {:?}", other),
        }
    }

}
