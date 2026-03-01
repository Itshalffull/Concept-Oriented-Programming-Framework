// generated: machine/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::MachineHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn machine_invariant_1() {
        // invariant 1: after spawn, send behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let m = "u-test-invariant-001".to_string();

        // --- AFTER clause ---
        // spawn(machine: m, widget: "dialog", context: "{}") -> ok(machine: m)
        let step1 = handler.spawn(
            SpawnInput { machine: m.clone(), widget: "dialog".to_string(), context: "{}".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            SpawnOutput::Ok { machine, .. } => {
                assert_eq!(machine, m.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // send(machine: m, event: "{ \"type\": \"OPEN\" }") -> ok(machine: m, state: "open")
        let step2 = handler.send(
            SendInput { machine: m.clone(), event: "{ "type": "OPEN" }".to_string() },
            &storage,
        ).await.unwrap();
        match step2 {
            SendOutput::Ok { machine, state, .. } => {
                assert_eq!(machine, m.clone());
                assert_eq!(state, "open".to_string());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
