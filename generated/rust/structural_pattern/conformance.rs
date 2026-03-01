// generated: structural_pattern/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::StructuralPatternHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn structural_pattern_invariant_1() {
        // invariant 1: after create, match behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let p = "u-test-invariant-001".to_string();
        let m = "u-test-invariant-002".to_string();

        // --- AFTER clause ---
        // create(syntax: "tree-sitter-query", source: "(function_declaration) @fn", language: "typescript") -> ok(pattern: p)
        let step1 = handler.create(
            CreateInput { syntax: "tree-sitter-query".to_string(), source: "(function_declaration) @fn".to_string(), language: "typescript".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            CreateOutput::Ok { pattern, .. } => {
                assert_eq!(pattern, p.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // match(pattern: p, tree: "some-tree") -> ok(matches: m)
        let step2 = handler.match(
            MatchInput { pattern: p.clone(), tree: "some-tree".to_string() },
            &storage,
        ).await.unwrap();
        match step2 {
            MatchOutput::Ok { matches, .. } => {
                assert_eq!(matches, m.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
