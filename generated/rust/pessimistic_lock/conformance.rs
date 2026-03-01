// generated: pessimistic_lock/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::PessimisticLockHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn pessimistic_lock_invariant_1() {
        // invariant 1: after checkOut, checkOut behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let r = "u-test-invariant-001".to_string();
        let h = "u-test-invariant-002".to_string();
        let l = "u-test-invariant-003".to_string();

        // --- AFTER clause ---
        // checkOut(resource: r, holder: h, duration: _, reason: _) -> ok(lockId: l)
        let step1 = handler.check_out(
            CheckOutInput { resource: r.clone(), holder: h.clone(), duration: .clone(), reason: .clone() },
            &storage,
        ).await.unwrap();
        match step1 {
            CheckOutOutput::Ok { lock_id, .. } => {
                assert_eq!(lock_id, l.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // checkOut(resource: r, holder: "other-user", duration: _, reason: _) -> alreadyLocked(holder: h, expires: _)
        let step2 = handler.check_out(
            CheckOutInput { resource: r.clone(), holder: "other-user".to_string(), duration: .clone(), reason: .clone() },
            &storage,
        ).await.unwrap();
        match step2 {
            CheckOutOutput::AlreadyLocked { holder, expires, .. } => {
                assert_eq!(holder, h.clone());
                assert_eq!(expires, .clone());
            },
            other => panic!("Expected AlreadyLocked, got {:?}", other),
        }
    }

    #[tokio::test]
    async fn pessimistic_lock_invariant_2() {
        // invariant 2: after checkOut, checkIn, checkOut behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let r = "u-test-invariant-001".to_string();
        let h = "u-test-invariant-002".to_string();
        let l = "u-test-invariant-003".to_string();

        // --- AFTER clause ---
        // checkOut(resource: r, holder: h, duration: _, reason: _) -> ok(lockId: l)
        let step1 = handler.check_out(
            CheckOutInput { resource: r.clone(), holder: h.clone(), duration: .clone(), reason: .clone() },
            &storage,
        ).await.unwrap();
        match step1 {
            CheckOutOutput::Ok { lock_id, .. } => {
                assert_eq!(lock_id, l.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // checkIn(lockId: l) -> ok()
        let step2 = handler.check_in(
            CheckInInput { lock_id: l.clone() },
            &storage,
        ).await.unwrap();
        assert!(matches!(step2, CheckInOutput::Ok));
        // checkOut(resource: r, holder: "other-user", duration: _, reason: _) -> ok(lockId: _)
        let step3 = handler.check_out(
            CheckOutInput { resource: r.clone(), holder: "other-user".to_string(), duration: .clone(), reason: .clone() },
            &storage,
        ).await.unwrap();
        match step3 {
            CheckOutOutput::Ok { lock_id, .. } => {
                assert_eq!(lock_id, .clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
