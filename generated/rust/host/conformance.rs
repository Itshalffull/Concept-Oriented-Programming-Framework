// generated: host/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::HostHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn host_invariant_1() {
        // invariant 1: after mount, unmount behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let w = "u-test-invariant-001".to_string();

        // --- AFTER clause ---
        // mount(host: w, concept: "urn:app/Article", view: "list", level: 0, zone: "primary") -> ok(host: w)
        let step1 = handler.mount(
            MountInput { host: w.clone(), concept: "urn:app/Article".to_string(), view: "list".to_string(), level: 0, zone: "primary".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            MountOutput::Ok { host, .. } => {
                assert_eq!(host, w.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // unmount(host: w) -> ok(host: w, machines: _, binding: _)
        let step2 = handler.unmount(
            UnmountInput { host: w.clone() },
            &storage,
        ).await.unwrap();
        match step2 {
            UnmountOutput::Ok { host, machines, binding, .. } => {
                assert_eq!(host, w.clone());
                assert_eq!(machines, .clone());
                assert_eq!(binding, .clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
