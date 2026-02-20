// generated: j_w_t/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::JWTHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn j_w_t_invariant_1() {
        // invariant 1: after generate, verify behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let x = "u-test-invariant-001".to_string();
        let t = "u-test-invariant-002".to_string();

        // --- AFTER clause ---
        // generate(user: x) -> ok(token: t)
        let step1 = handler.generate(
            GenerateInput { user: x.clone() },
            &storage,
        ).await.unwrap();
        match step1 {
            GenerateOutput::Ok { token, .. } => {
                assert_eq!(token, t.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // verify(token: t) -> ok(user: x)
        let step2 = handler.verify(
            VerifyInput { token: t.clone() },
            &storage,
        ).await.unwrap();
        match step2 {
            VerifyOutput::Ok { user, .. } => {
                assert_eq!(user, x.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
