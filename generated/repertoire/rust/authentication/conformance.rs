// generated: authentication/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::AuthenticationHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn authentication_invariant_1() {
        // invariant 1: after register, login behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let x = "u-test-invariant-001".to_string();
        let t = "u-test-invariant-002".to_string();

        // --- AFTER clause ---
        // register(user: x, provider: "local", credentials: "secret123") -> ok(user: x)
        let step1 = handler.register(
            RegisterInput { user: x.clone(), provider: "local".to_string(), credentials: "secret123".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            RegisterOutput::Ok { user, .. } => {
                assert_eq!(user, x.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // login(user: x, credentials: "secret123") -> ok(token: t)
        let step2 = handler.login(
            LoginInput { user: x.clone(), credentials: "secret123".to_string() },
            &storage,
        ).await.unwrap();
        match step2 {
            LoginOutput::Ok { token, .. } => {
                assert_eq!(token, t.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

    #[tokio::test]
    async fn authentication_invariant_2() {
        // invariant 2: after register, login, authenticate behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let x = "u-test-invariant-001".to_string();
        let t = "u-test-invariant-002".to_string();

        // --- AFTER clause ---
        // register(user: x, provider: "local", credentials: "secret123") -> ok(user: x)
        let step1 = handler.register(
            RegisterInput { user: x.clone(), provider: "local".to_string(), credentials: "secret123".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            RegisterOutput::Ok { user, .. } => {
                assert_eq!(user, x.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
        // login(user: x, credentials: "secret123") -> ok(token: t)
        let step2 = handler.login(
            LoginInput { user: x.clone(), credentials: "secret123".to_string() },
            &storage,
        ).await.unwrap();
        match step2 {
            LoginOutput::Ok { token, .. } => {
                assert_eq!(token, t.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // authenticate(token: t) -> ok(user: x)
        let step3 = handler.authenticate(
            AuthenticateInput { token: t.clone() },
            &storage,
        ).await.unwrap();
        match step3 {
            AuthenticateOutput::Ok { user, .. } => {
                assert_eq!(user, x.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

    #[tokio::test]
    async fn authentication_invariant_3() {
        // invariant 3: after register, register behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let x = "u-test-invariant-001".to_string();
        let m = "u-test-invariant-002".to_string();

        // --- AFTER clause ---
        // register(user: x, provider: "local", credentials: "secret123") -> ok(user: x)
        let step1 = handler.register(
            RegisterInput { user: x.clone(), provider: "local".to_string(), credentials: "secret123".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            RegisterOutput::Ok { user, .. } => {
                assert_eq!(user, x.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // register(user: x, provider: "oauth", credentials: "token456") -> exists(message: m)
        let step2 = handler.register(
            RegisterInput { user: x.clone(), provider: "oauth".to_string(), credentials: "token456".to_string() },
            &storage,
        ).await.unwrap();
        match step2 {
            RegisterOutput::Exists { message, .. } => {
                assert_eq!(message, m.clone());
            },
            other => panic!("Expected Exists, got {:?}", other),
        }
    }

    #[tokio::test]
    async fn authentication_invariant_4() {
        // invariant 4: after register, resetPassword, login behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let x = "u-test-invariant-001".to_string();
        let m = "u-test-invariant-002".to_string();

        // --- AFTER clause ---
        // register(user: x, provider: "local", credentials: "secret123") -> ok(user: x)
        let step1 = handler.register(
            RegisterInput { user: x.clone(), provider: "local".to_string(), credentials: "secret123".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            RegisterOutput::Ok { user, .. } => {
                assert_eq!(user, x.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
        // resetPassword(user: x, newCredentials: "newpass456") -> ok(user: x)
        let step2 = handler.reset_password(
            ResetPasswordInput { user: x.clone(), new_credentials: "newpass456".to_string() },
            &storage,
        ).await.unwrap();
        match step2 {
            ResetPasswordOutput::Ok { user, .. } => {
                assert_eq!(user, x.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // login(user: x, credentials: "secret123") -> invalid(message: m)
        let step3 = handler.login(
            LoginInput { user: x.clone(), credentials: "secret123".to_string() },
            &storage,
        ).await.unwrap();
        match step3 {
            LoginOutput::Invalid { message, .. } => {
                assert_eq!(message, m.clone());
            },
            other => panic!("Expected Invalid, got {:?}", other),
        }
    }

}
