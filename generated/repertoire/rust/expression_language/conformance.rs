// generated: expression_language/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::ExpressionLanguageHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn expression_language_invariant_1() {
        // invariant 1: after registerLanguage, parse, evaluate behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let e = "u-test-invariant-001".to_string();

        // --- AFTER clause ---
        // registerLanguage(name: "math", grammar: "arithmetic") -> ok()
        let step1 = handler.register_language(
            RegisterLanguageInput { name: "math".to_string(), grammar: "arithmetic".to_string() },
            &storage,
        ).await.unwrap();
        assert!(matches!(step1, RegisterLanguageOutput::Ok));

        // --- THEN clause ---
        // parse(expression: e, text: "2 + 3", language: "math") -> ok(ast: "add(2, 3)")
        let step2 = handler.parse(
            ParseInput { expression: e.clone(), text: "2 + 3".to_string(), language: "math".to_string() },
            &storage,
        ).await.unwrap();
        match step2 {
            ParseOutput::Ok { ast, .. } => {
                assert_eq!(ast, "add(2, 3)".to_string());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
        // evaluate(expression: e) -> ok(result: "5")
        let step3 = handler.evaluate(
            EvaluateInput { expression: e.clone() },
            &storage,
        ).await.unwrap();
        match step3 {
            EvaluateOutput::Ok { result, .. } => {
                assert_eq!(result, "5".to_string());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
