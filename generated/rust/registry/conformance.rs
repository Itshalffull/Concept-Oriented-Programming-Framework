// generated: registry/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::RegistryHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn registry_invariant_1() {
        // invariant 1: after register, heartbeat behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let c = "u-test-invariant-001".to_string();

        // --- AFTER clause ---
        // register(uri: "test://concept-a", transport: "in-process") -> ok(concept: c)
        let step1 = handler.register(
            RegisterInput { uri: "test://concept-a".to_string(), transport: "in-process".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            RegisterOutput::Ok { concept, .. } => {
                assert_eq!(concept, c.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // heartbeat(uri: "test://concept-a") -> ok(available: true)
        let step2 = handler.heartbeat(
            HeartbeatInput { uri: "test://concept-a".to_string() },
            &storage,
        ).await.unwrap();
        match step2 {
            HeartbeatOutput::Ok { available, .. } => {
                assert_eq!(available, true);
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
