// generated: platform_adapter/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::PlatformAdapterHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn platform_adapter_invariant_1() {
        // invariant 1: after register, mapNavigation behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let d = "u-test-invariant-001".to_string();

        // --- AFTER clause ---
        // register(adapter: d, platform: "browser", config: "{}") -> ok(adapter: d)
        let step1 = handler.register(
            RegisterInput { adapter: d.clone(), platform: "browser".to_string(), config: "{}".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            RegisterOutput::Ok { adapter, .. } => {
                assert_eq!(adapter, d.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // mapNavigation(adapter: d, transition: "{ \"type\": \"push\" }") -> ok(adapter: d, platformAction: _)
        let step2 = handler.map_navigation(
            MapNavigationInput { adapter: d.clone(), transition: "{ "type": "push" }".to_string() },
            &storage,
        ).await.unwrap();
        match step2 {
            MapNavigationOutput::Ok { adapter, platform_action, .. } => {
                assert_eq!(adapter, d.clone());
                assert_eq!(platform_action, .clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
