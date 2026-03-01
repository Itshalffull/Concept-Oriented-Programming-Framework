// generated: replica/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::ReplicaHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn replica_invariant_1() {
        // invariant 1: after localUpdate, getState behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let o = "u-test-invariant-001".to_string();
        let n = "u-test-invariant-002".to_string();
        let s = "u-test-invariant-003".to_string();
        let c = "u-test-invariant-004".to_string();

        // --- AFTER clause ---
        // localUpdate(op: o) -> ok(newState: n)
        let step1 = handler.local_update(
            LocalUpdateInput { op: o.clone() },
            &storage,
        ).await.unwrap();
        match step1 {
            LocalUpdateOutput::Ok { new_state, .. } => {
                assert_eq!(new_state, n.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // getState() -> ok(state: s, clock: c)
        let step2 = handler.get_state(
            GetStateInput {  },
            &storage,
        ).await.unwrap();
        match step2 {
            GetStateOutput::Ok { state, clock, .. } => {
                assert_eq!(state, s.clone());
                assert_eq!(clock, c.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
