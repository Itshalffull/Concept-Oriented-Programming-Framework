// generated: affordance/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::AffordanceHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn affordance_invariant_1() {
        // invariant 1: after declare, declare, match behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let f1 = "u-test-invariant-001".to_string();
        let f2 = "u-test-invariant-002".to_string();

        // --- AFTER clause ---
        // declare(affordance: f1, widget: "radio-group", interactor: "single-choice", specificity: 10, conditions: "{ \"maxOptions\": 8 }") -> ok(affordance: f1)
        let step1 = handler.declare(
            DeclareInput { affordance: f1.clone(), widget: "radio-group".to_string(), interactor: "single-choice".to_string(), specificity: 10, conditions: "{ "maxOptions": 8 }".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            DeclareOutput::Ok { affordance, .. } => {
                assert_eq!(affordance, f1.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
        // declare(affordance: f2, widget: "select", interactor: "single-choice", specificity: 5, conditions: _) -> ok(affordance: f2)
        let step2 = handler.declare(
            DeclareInput { affordance: f2.clone(), widget: "select".to_string(), interactor: "single-choice".to_string(), specificity: 5, conditions: .clone() },
            &storage,
        ).await.unwrap();
        match step2 {
            DeclareOutput::Ok { affordance, .. } => {
                assert_eq!(affordance, f2.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // match(affordance: _, interactor: "single-choice", context: "{ \"optionCount\": 4 }") -> ok(matches: _)
        let step3 = handler.match(
            MatchInput { affordance: .clone(), interactor: "single-choice".to_string(), context: "{ "optionCount": 4 }".to_string() },
            &storage,
        ).await.unwrap();
        match step3 {
            MatchOutput::Ok { matches, .. } => {
                assert_eq!(matches, .clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
