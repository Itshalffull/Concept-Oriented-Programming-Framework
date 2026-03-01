// generated: interactor/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::InteractorHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn interactor_invariant_1() {
        // invariant 1: after define, classify behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let i = "u-test-invariant-001".to_string();

        // --- AFTER clause ---
        // define(interactor: i, name: "single-choice", category: "selection", properties: "{ \"cardinality\": \"one\", \"comparison\": true }") -> ok(interactor: i)
        let step1 = handler.define(
            DefineInput { interactor: i.clone(), name: "single-choice".to_string(), category: "selection".to_string(), properties: "{ "cardinality": "one", "comparison": true }".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            DefineOutput::Ok { interactor, .. } => {
                assert_eq!(interactor, i.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // classify(interactor: _, fieldType: "T -> T", constraints: "{ \"enum\": [\"A\",\"B\",\"C\"] }", intent: _) -> ok(interactor: _, confidence: _)
        let step2 = handler.classify(
            ClassifyInput { interactor: .clone(), field_type: "T -> T".to_string(), constraints: "{ "enum": ["A","B","C"] }".to_string(), intent: .clone() },
            &storage,
        ).await.unwrap();
        match step2 {
            ClassifyOutput::Ok { interactor, confidence, .. } => {
                assert_eq!(interactor, .clone());
                assert_eq!(confidence, .clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
