// generated: formula/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::FormulaHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn formula_invariant_1() {
        // invariant 1: after create, evaluate behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let f = "u-test-invariant-001".to_string();

        // --- AFTER clause ---
        // create(formula: f, expression: "price * quantity") -> ok()
        let step1 = handler.create(
            CreateInput { formula: f.clone(), expression: "price * quantity".to_string() },
            &storage,
        ).await.unwrap();
        assert!(matches!(step1, CreateOutput::Ok));

        // --- THEN clause ---
        // evaluate(formula: f) -> ok(result: "computed")
        let step2 = handler.evaluate(
            EvaluateInput { formula: f.clone() },
            &storage,
        ).await.unwrap();
        match step2 {
            EvaluateOutput::Ok { result, .. } => {
                assert_eq!(result, "computed".to_string());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
