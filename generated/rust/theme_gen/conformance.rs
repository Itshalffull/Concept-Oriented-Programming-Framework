// generated: theme_gen/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::ThemeGenHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn theme_gen_invariant_1() {
        // invariant 1: after generate, generate behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let g = "u-test-invariant-001".to_string();

        // --- AFTER clause ---
        // generate(gen: g, target: "css-variables", themeAst: _) -> ok(gen: g, output: _)
        let step1 = handler.generate(
            GenerateInput { gen: g.clone(), target: "css-variables".to_string(), theme_ast: .clone() },
            &storage,
        ).await.unwrap();
        match step1 {
            GenerateOutput::Ok { gen, output, .. } => {
                assert_eq!(gen, g.clone());
                assert_eq!(output, .clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // generate(gen: g, target: "css-variables", themeAst: _) -> ok(gen: g, output: _)
        let step2 = handler.generate(
            GenerateInput { gen: g.clone(), target: "css-variables".to_string(), theme_ast: .clone() },
            &storage,
        ).await.unwrap();
        match step2 {
            GenerateOutput::Ok { gen, output, .. } => {
                assert_eq!(gen, g.clone());
                assert_eq!(output, .clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
