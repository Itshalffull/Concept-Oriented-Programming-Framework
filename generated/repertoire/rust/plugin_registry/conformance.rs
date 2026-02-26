// generated: plugin_registry/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::PluginRegistryHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn plugin_registry_invariant_1() {
        // invariant 1: after discover, createInstance, getDefinitions behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let ps = "u-test-invariant-001".to_string();
        let p = "u-test-invariant-002".to_string();
        let i = "u-test-invariant-003".to_string();
        let ds = "u-test-invariant-004".to_string();

        // --- AFTER clause ---
        // discover(type: "formatter") -> ok(plugins: ps)
        let step1 = handler.discover(
            DiscoverInput { type: "formatter".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            DiscoverOutput::Ok { plugins, .. } => {
                assert_eq!(plugins, ps.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // createInstance(plugin: p, config: "{}") -> ok(instance: i)
        let step2 = handler.create_instance(
            CreateInstanceInput { plugin: p.clone(), config: "{}".to_string() },
            &storage,
        ).await.unwrap();
        match step2 {
            CreateInstanceOutput::Ok { instance, .. } => {
                assert_eq!(instance, i.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
        // getDefinitions(type: "formatter") -> ok(definitions: ds)
        let step3 = handler.get_definitions(
            GetDefinitionsInput { type: "formatter".to_string() },
            &storage,
        ).await.unwrap();
        match step3 {
            GetDefinitionsOutput::Ok { definitions, .. } => {
                assert_eq!(definitions, ds.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
