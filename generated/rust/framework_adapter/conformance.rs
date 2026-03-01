// generated: framework_adapter/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::FrameworkAdapterHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn framework_adapter_invariant_1() {
        // invariant 1: after register, normalize behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let r = "u-test-invariant-001".to_string();

        // --- AFTER clause ---
        // register(renderer: r, framework: "react", version: "19", normalizer: "reactNormalizer", mountFn: "reactMount") -> ok(renderer: r)
        let step1 = handler.register(
            RegisterInput { renderer: r.clone(), framework: "react".to_string(), version: "19".to_string(), normalizer: "reactNormalizer".to_string(), mount_fn: "reactMount".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            RegisterOutput::Ok { renderer, .. } => {
                assert_eq!(renderer, r.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // normalize(renderer: r, props: "{ \"onClick\": \"handler_1\" }") -> ok(normalized: _)
        let step2 = handler.normalize(
            NormalizeInput { renderer: r.clone(), props: "{ "onClick": "handler_1" }".to_string() },
            &storage,
        ).await.unwrap();
        match step2 {
            NormalizeOutput::Ok { normalized, .. } => {
                assert_eq!(normalized, .clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
