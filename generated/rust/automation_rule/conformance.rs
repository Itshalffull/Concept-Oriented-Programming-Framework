// generated: automation_rule/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::AutomationRuleHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn automation_rule_invariant_1() {
        // invariant 1: after define, enable behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let r = "u-test-invariant-001".to_string();

        // --- AFTER clause ---
        // define(rule: r, trigger: "on_save", conditions: "status == draft", actions: "notify_reviewer") -> ok()
        let step1 = handler.define(
            DefineInput { rule: r.clone(), trigger: "on_save".to_string(), conditions: "status == draft".to_string(), actions: "notify_reviewer".to_string() },
            &storage,
        ).await.unwrap();
        assert!(matches!(step1, DefineOutput::Ok));

        // --- THEN clause ---
        // enable(rule: r) -> ok()
        let step2 = handler.enable(
            EnableInput { rule: r.clone() },
            &storage,
        ).await.unwrap();
        assert!(matches!(step2, EnableOutput::Ok));
    }

}
