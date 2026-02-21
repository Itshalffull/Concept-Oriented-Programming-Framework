// generated: validator/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::ValidatorHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn validator_invariant_1() {
        // invariant 1: after registerConstraint, addRule, validate behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let v = "u-test-invariant-001".to_string();

        // --- AFTER clause ---
        // registerConstraint(validator: v, constraint: "required") -> ok()
        let step1 = handler.register_constraint(
            RegisterConstraintInput { validator: v.clone(), constraint: "required".to_string() },
            &storage,
        ).await.unwrap();
        assert!(matches!(step1, RegisterConstraintOutput::Ok));

        // --- THEN clause ---
        // addRule(validator: v, field: "email", rule: "required|email") -> ok()
        let step2 = handler.add_rule(
            AddRuleInput { validator: v.clone(), field: "email".to_string(), rule: "required|email".to_string() },
            &storage,
        ).await.unwrap();
        assert!(matches!(step2, AddRuleOutput::Ok));
        // validate(validator: v, data: "{\"email\":\"\"}") -> ok(valid: false, errors: "email is required")
        let step3 = handler.validate(
            ValidateInput { validator: v.clone(), data: "{"email":""}".to_string() },
            &storage,
        ).await.unwrap();
        match step3 {
            ValidateOutput::Ok { valid, errors, .. } => {
                assert_eq!(valid, false);
                assert_eq!(errors, "email is required".to_string());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
