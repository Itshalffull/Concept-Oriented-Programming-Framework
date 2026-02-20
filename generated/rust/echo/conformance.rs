// generated: echo/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::EchoHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn echo_invariant_1() {
        // invariant 1: after send, send behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let m = "u-test-invariant-001".to_string();

        // --- AFTER clause ---
        // send(id: m, text: "hello") -> ok(id: m, echo: "hello")
        let step1 = handler.send(
            SendInput { id: m.clone(), text: "hello".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            SendOutput::Ok { id, echo, .. } => {
                assert_eq!(id, m.clone());
                assert_eq!(echo, "hello".to_string());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // send(id: m, text: "hello") -> ok(id: m, echo: "hello")
        let step2 = handler.send(
            SendInput { id: m.clone(), text: "hello".to_string() },
            &storage,
        ).await.unwrap();
        match step2 {
            SendOutput::Ok { id, echo, .. } => {
                assert_eq!(id, m.clone());
                assert_eq!(echo, "hello".to_string());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
