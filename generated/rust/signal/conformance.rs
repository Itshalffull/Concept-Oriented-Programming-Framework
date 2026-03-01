// generated: signal/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::SignalHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn signal_invariant_1() {
        // invariant 1: after create, read behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let g = "u-test-invariant-001".to_string();

        // --- AFTER clause ---
        // create(signal: g, kind: "state", initialValue: "hello") -> ok(signal: g)
        let step1 = handler.create(
            CreateInput { signal: g.clone(), kind: "state".to_string(), initial_value: "hello".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            CreateOutput::Ok { signal, .. } => {
                assert_eq!(signal, g.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // read(signal: g) -> ok(signal: g, value: "hello", version: _)
        let step2 = handler.read(
            ReadInput { signal: g.clone() },
            &storage,
        ).await.unwrap();
        match step2 {
            ReadOutput::Ok { signal, value, version, .. } => {
                assert_eq!(signal, g.clone());
                assert_eq!(value, "hello".to_string());
                assert_eq!(version, .clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
