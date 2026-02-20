// generated: password/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::PasswordHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn password_invariant_1() {
        // invariant 1: after set, check, check behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let x = "u-test-invariant-001".to_string();

        // --- AFTER clause ---
        // set(user: x, password: "secret123") -> ok(user: x)
        let step1 = handler.set(
            SetInput { user: x.clone(), password: "secret123".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            SetOutput::Ok { user, .. } => {
                assert_eq!(user, x.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // check(user: x, password: "secret123") -> ok(valid: true)
        let step2 = handler.check(
            CheckInput { user: x.clone(), password: "secret123".to_string() },
            &storage,
        ).await.unwrap();
        match step2 {
            CheckOutput::Ok { valid, .. } => {
                assert_eq!(valid, true);
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
        // check(user: x, password: "wrongpass") -> ok(valid: false)
        let step3 = handler.check(
            CheckInput { user: x.clone(), password: "wrongpass".to_string() },
            &storage,
        ).await.unwrap();
        match step3 {
            CheckOutput::Ok { valid, .. } => {
                assert_eq!(valid, false);
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
