// generated: flag/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::FlagHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn flag_invariant_1() {
        // invariant 1: after flag, isFlagged behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let f = "u-test-invariant-001".to_string();
        let t = "u-test-invariant-002".to_string();
        let e = "u-test-invariant-003".to_string();
        let u = "u-test-invariant-004".to_string();

        // --- AFTER clause ---
        // flag(flagging: f, flagType: t, entity: e, user: u) -> ok()
        let step1 = handler.flag(
            FlagInput { flagging: f.clone(), flag_type: t.clone(), entity: e.clone(), user: u.clone() },
            &storage,
        ).await.unwrap();
        assert!(matches!(step1, FlagOutput::Ok));

        // --- THEN clause ---
        // isFlagged(flagType: t, entity: e, user: u) -> ok(flagged: true)
        let step2 = handler.is_flagged(
            IsFlaggedInput { flag_type: t.clone(), entity: e.clone(), user: u.clone() },
            &storage,
        ).await.unwrap();
        match step2 {
            IsFlaggedOutput::Ok { flagged, .. } => {
                assert_eq!(flagged, true);
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

    #[tokio::test]
    async fn flag_invariant_2() {
        // invariant 2: after flag, unflag, isFlagged behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let f = "u-test-invariant-001".to_string();
        let t = "u-test-invariant-002".to_string();
        let e = "u-test-invariant-003".to_string();
        let u = "u-test-invariant-004".to_string();

        // --- AFTER clause ---
        // flag(flagging: f, flagType: t, entity: e, user: u) -> ok()
        let step1 = handler.flag(
            FlagInput { flagging: f.clone(), flag_type: t.clone(), entity: e.clone(), user: u.clone() },
            &storage,
        ).await.unwrap();
        assert!(matches!(step1, FlagOutput::Ok));

        // --- THEN clause ---
        // unflag(flagging: f) -> ok()
        let step2 = handler.unflag(
            UnflagInput { flagging: f.clone() },
            &storage,
        ).await.unwrap();
        assert!(matches!(step2, UnflagOutput::Ok));
        // isFlagged(flagType: t, entity: e, user: u) -> ok(flagged: false)
        let step3 = handler.is_flagged(
            IsFlaggedInput { flag_type: t.clone(), entity: e.clone(), user: u.clone() },
            &storage,
        ).await.unwrap();
        match step3 {
            IsFlaggedOutput::Ok { flagged, .. } => {
                assert_eq!(flagged, false);
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
