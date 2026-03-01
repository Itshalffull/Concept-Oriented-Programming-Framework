// generated: binding/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::BindingHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn binding_invariant_1() {
        // invariant 1: after bind, sync, bind behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let b = "u-test-invariant-001".to_string();
        let c = "u-test-invariant-002".to_string();
        let b2 = "u-test-invariant-003".to_string();
        let c2 = "u-test-invariant-004".to_string();

        // --- AFTER clause ---
        // bind(binding: b, concept: c, mode: "static") -> ok(binding: b)
        let step1 = handler.bind(
            BindInput { binding: b.clone(), concept: c.clone(), mode: "static".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            BindOutput::Ok { binding, .. } => {
                assert_eq!(binding, b.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // sync(binding: b) -> ok(binding: b)
        let step2 = handler.sync(
            SyncInput { binding: b.clone() },
            &storage,
        ).await.unwrap();
        match step2 {
            SyncOutput::Ok { binding, .. } => {
                assert_eq!(binding, b.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
        // bind(binding: b2, concept: c2, mode: "invalid-mode") -> invalid(message: _)
        let step3 = handler.bind(
            BindInput { binding: b2.clone(), concept: c2.clone(), mode: "invalid-mode".to_string() },
            &storage,
        ).await.unwrap();
        match step3 {
            BindOutput::Invalid { message, .. } => {
                assert_eq!(message, .clone());
            },
            other => panic!("Expected Invalid, got {:?}", other),
        }
    }

}
