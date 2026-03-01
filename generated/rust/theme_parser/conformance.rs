// generated: theme_parser/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::ThemeParserHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn theme_parser_invariant_1() {
        // invariant 1: after parse, checkContrast behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let h = "u-test-invariant-001".to_string();

        // --- AFTER clause ---
        // parse(theme: h, source: "theme light { ... }") -> ok(theme: h, ast: _)
        let step1 = handler.parse(
            ParseInput { theme: h.clone(), source: "theme light { ... }".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            ParseOutput::Ok { theme, ast, .. } => {
                assert_eq!(theme, h.clone());
                assert_eq!(ast, .clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // checkContrast(theme: h) -> ok(theme: h)
        let step2 = handler.check_contrast(
            CheckContrastInput { theme: h.clone() },
            &storage,
        ).await.unwrap();
        match step2 {
            CheckContrastOutput::Ok { theme, .. } => {
                assert_eq!(theme, h.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
