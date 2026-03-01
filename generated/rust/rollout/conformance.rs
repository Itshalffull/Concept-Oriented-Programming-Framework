// generated: rollout/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::RolloutHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn rollout_invariant_1() {
        // invariant 1: after begin, advance behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let s = "u-test-invariant-001".to_string();
        let r = "u-test-invariant-002".to_string();

        // --- AFTER clause ---
        // begin(plan: "dp-001", strategy: "canary", steps: s) -> ok(rollout: r)
        let step1 = handler.begin(
            BeginInput { plan: "dp-001".to_string(), strategy: "canary".to_string(), steps: s.clone() },
            &storage,
        ).await.unwrap();
        match step1 {
            BeginOutput::Ok { rollout, .. } => {
                assert_eq!(rollout, r.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // advance(rollout: r) -> ok(rollout: r, newWeight: 25, step: 2)
        let step2 = handler.advance(
            AdvanceInput { rollout: r.clone() },
            &storage,
        ).await.unwrap();
        match step2 {
            AdvanceOutput::Ok { rollout, new_weight, step, .. } => {
                assert_eq!(rollout, r.clone());
                assert_eq!(new_weight, 25);
                assert_eq!(step, 2);
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
