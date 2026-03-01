// generated: dev_server/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::DevServerHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn dev_server_invariant_1() {
        // invariant 1: after start, stop behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let d = "u-test-invariant-001".to_string();

        // --- AFTER clause ---
        // start(port: 3000, watchDirs: ["./specs", "./syncs"]) -> ok(session: d, port: 3000, url: "http://localhost:3000")
        let step1 = handler.start(
            StartInput { port: 3000, watch_dirs: todo!(/* list: ["./specs".to_string(), "./syncs".to_string()] */) },
            &storage,
        ).await.unwrap();
        match step1 {
            StartOutput::Ok { session, port, url, .. } => {
                assert_eq!(session, d.clone());
                assert_eq!(port, 3000);
                assert_eq!(url, "http://localhost:3000".to_string());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // stop(session: d) -> ok(session: d)
        let step2 = handler.stop(
            StopInput { session: d.clone() },
            &storage,
        ).await.unwrap();
        match step2 {
            StopOutput::Ok { session, .. } => {
                assert_eq!(session, d.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
