// generated: intent/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::IntentHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn intent_invariant_1() {
        // invariant 1: after define, verify behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let i = "u-test-invariant-001".to_string();
        let v = "u-test-invariant-002".to_string();
        let f = "u-test-invariant-003".to_string();

        // --- AFTER clause ---
        // define(intent: i, target: "UserAuth", purpose: "Authenticate users", operationalPrinciple: "After login, session is valid") -> ok(intent: i)
        let step1 = handler.define(
            DefineInput { intent: i.clone(), target: "UserAuth".to_string(), purpose: "Authenticate users".to_string(), operational_principle: "After login, session is valid".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            DefineOutput::Ok { intent, .. } => {
                assert_eq!(intent, i.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // verify(intent: i) -> ok(valid: v, failures: f)
        let step2 = handler.verify(
            VerifyInput { intent: i.clone() },
            &storage,
        ).await.unwrap();
        match step2 {
            VerifyOutput::Ok { valid, failures, .. } => {
                assert_eq!(valid, v.clone());
                assert_eq!(failures, f.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
