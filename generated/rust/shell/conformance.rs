// generated: shell/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::ShellHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn shell_invariant_1() {
        // invariant 1: after initialize, assignToZone behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let s = "u-test-invariant-001".to_string();

        // --- AFTER clause ---
        // initialize(shell: s, zones: "{ \"zones\": [{ \"name\": \"primary\", \"role\": \"navigated\" }] }") -> ok(shell: s)
        let step1 = handler.initialize(
            InitializeInput { shell: s.clone(), zones: "{ "zones": [{ "name": "primary", "role": "navigated" }] }".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            InitializeOutput::Ok { shell, .. } => {
                assert_eq!(shell, s.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // assignToZone(shell: s, zone: "primary", ref: "host-1") -> ok(shell: s)
        let step2 = handler.assign_to_zone(
            AssignToZoneInput { shell: s.clone(), zone: "primary".to_string(), ref: "host-1".to_string() },
            &storage,
        ).await.unwrap();
        match step2 {
            AssignToZoneOutput::Ok { shell, .. } => {
                assert_eq!(shell, s.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
