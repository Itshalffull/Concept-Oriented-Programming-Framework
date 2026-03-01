// generated: syntax_tree/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::SyntaxTreeHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn syntax_tree_invariant_1() {
        // invariant 1: after parse, get behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let t = "u-test-invariant-001".to_string();
        let b = "u-test-invariant-002".to_string();

        // --- AFTER clause ---
        // parse(file: "test.ts", grammar: "typescript") -> ok(tree: t)
        let step1 = handler.parse(
            ParseInput { file: "test.ts".to_string(), grammar: "typescript".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            ParseOutput::Ok { tree, .. } => {
                assert_eq!(tree, t.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // get(tree: t) -> ok(tree: t, source: "test.ts", grammar: "typescript", byteLength: b, editVersion: 1, errorRanges: "[]")
        let step2 = handler.get(
            GetInput { tree: t.clone() },
            &storage,
        ).await.unwrap();
        match step2 {
            GetOutput::Ok { tree, source, grammar, byte_length, edit_version, error_ranges, .. } => {
                assert_eq!(tree, t.clone());
                assert_eq!(source, "test.ts".to_string());
                assert_eq!(grammar, "typescript".to_string());
                assert_eq!(byte_length, b.clone());
                assert_eq!(edit_version, 1);
                assert_eq!(error_ranges, "[]".to_string());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
