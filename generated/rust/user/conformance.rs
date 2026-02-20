// generated: user/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::UserHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn user_invariant_1() {
        // invariant 1: after register, register behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let x = "u-test-invariant-001".to_string();
        let y = "u-test-invariant-002".to_string();

        // --- AFTER clause ---
        // register(user: x, name: "alice", email: "a@b.com") -> ok(user: x)
        let step1 = handler.register(
            RegisterInput { user: x.clone(), name: "alice".to_string(), email: "a@b.com".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            RegisterOutput::Ok { user, .. } => {
                assert_eq!(user, x.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // register(user: y, name: "alice", email: "c@d.com") -> error(message: "name already taken")
        let step2 = handler.register(
            RegisterInput { user: y.clone(), name: "alice".to_string(), email: "c@d.com".to_string() },
            &storage,
        ).await.unwrap();
        match step2 {
            RegisterOutput::Error { message, .. } => {
                assert_eq!(message, "name already taken".to_string());
            },
            other => panic!("Expected Error, got {:?}", other),
        }
    }

}
