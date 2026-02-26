// generated: session/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::SessionHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn session_invariant_1() {
        // invariant 1: after create, validate behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let s = "u-test-invariant-001".to_string();
        let t = "u-test-invariant-002".to_string();

        // --- AFTER clause ---
        // create(session: s, userId: "alice", device: "mobile") -> ok(token: t)
        let step1 = handler.create(
            CreateInput { session: s.clone(), user_id: "alice".to_string(), device: "mobile".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            CreateOutput::Ok { token, .. } => {
                assert_eq!(token, t.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // validate(session: s) -> ok(valid: true)
        let step2 = handler.validate(
            ValidateInput { session: s.clone() },
            &storage,
        ).await.unwrap();
        match step2 {
            ValidateOutput::Ok { valid, .. } => {
                assert_eq!(valid, true);
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

    #[tokio::test]
    async fn session_invariant_2() {
        // invariant 2: after create, getContext behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let s = "u-test-invariant-001".to_string();
        let t = "u-test-invariant-002".to_string();

        // --- AFTER clause ---
        // create(session: s, userId: "alice", device: "mobile") -> ok(token: t)
        let step1 = handler.create(
            CreateInput { session: s.clone(), user_id: "alice".to_string(), device: "mobile".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            CreateOutput::Ok { token, .. } => {
                assert_eq!(token, t.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // getContext(session: s) -> ok(userId: "alice", device: "mobile")
        let step2 = handler.get_context(
            GetContextInput { session: s.clone() },
            &storage,
        ).await.unwrap();
        match step2 {
            GetContextOutput::Ok { user_id, device, .. } => {
                assert_eq!(user_id, "alice".to_string());
                assert_eq!(device, "mobile".to_string());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

    #[tokio::test]
    async fn session_invariant_3() {
        // invariant 3: after create, destroy, validate behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let s = "u-test-invariant-001".to_string();
        let t = "u-test-invariant-002".to_string();
        let m = "u-test-invariant-003".to_string();

        // --- AFTER clause ---
        // create(session: s, userId: "alice", device: "mobile") -> ok(token: t)
        let step1 = handler.create(
            CreateInput { session: s.clone(), user_id: "alice".to_string(), device: "mobile".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            CreateOutput::Ok { token, .. } => {
                assert_eq!(token, t.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
        // destroy(session: s) -> ok(session: s)
        let step2 = handler.destroy(
            DestroyInput { session: s.clone() },
            &storage,
        ).await.unwrap();
        match step2 {
            DestroyOutput::Ok { session, .. } => {
                assert_eq!(session, s.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // validate(session: s) -> notfound(message: m)
        let step3 = handler.validate(
            ValidateInput { session: s.clone() },
            &storage,
        ).await.unwrap();
        match step3 {
            ValidateOutput::Notfound { message, .. } => {
                assert_eq!(message, m.clone());
            },
            other => panic!("Expected Notfound, got {:?}", other),
        }
    }

    #[tokio::test]
    async fn session_invariant_4() {
        // invariant 4: after create, create, destroyAll, validate behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let s1 = "u-test-invariant-001".to_string();
        let t1 = "u-test-invariant-002".to_string();
        let s2 = "u-test-invariant-003".to_string();
        let t2 = "u-test-invariant-004".to_string();
        let m1 = "u-test-invariant-005".to_string();

        // --- AFTER clause ---
        // create(session: s1, userId: "alice", device: "mobile") -> ok(token: t1)
        let step1 = handler.create(
            CreateInput { session: s1.clone(), user_id: "alice".to_string(), device: "mobile".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            CreateOutput::Ok { token, .. } => {
                assert_eq!(token, t1.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
        // create(session: s2, userId: "alice", device: "desktop") -> ok(token: t2)
        let step2 = handler.create(
            CreateInput { session: s2.clone(), user_id: "alice".to_string(), device: "desktop".to_string() },
            &storage,
        ).await.unwrap();
        match step2 {
            CreateOutput::Ok { token, .. } => {
                assert_eq!(token, t2.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
        // destroyAll(userId: "alice") -> ok(userId: "alice")
        let step3 = handler.destroy_all(
            DestroyAllInput { user_id: "alice".to_string() },
            &storage,
        ).await.unwrap();
        match step3 {
            DestroyAllOutput::Ok { user_id, .. } => {
                assert_eq!(user_id, "alice".to_string());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // validate(session: s1) -> notfound(message: m1)
        let step4 = handler.validate(
            ValidateInput { session: s1.clone() },
            &storage,
        ).await.unwrap();
        match step4 {
            ValidateOutput::Notfound { message, .. } => {
                assert_eq!(message, m1.clone());
            },
            other => panic!("Expected Notfound, got {:?}", other),
        }
    }

}
