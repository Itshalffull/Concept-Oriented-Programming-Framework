// generated: spec_parser/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::SpecParserHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn spec_parser_invariant_1() {
        // invariant 1: after parse, parse behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let s = "u-test-invariant-001".to_string();
        let a = "u-test-invariant-002".to_string();
        let m = "u-test-invariant-003".to_string();

        // --- AFTER clause ---
        // parse(source: "concept Tiny [X] { purpose { A test. } state { items: set X } actions { action get(x: X) { -> ok(item: X) { Return. } } } }") -> ok(spec: s, ast: a)
        let step1 = handler.parse(
            ParseInput { source: "concept Tiny [X] { purpose { A test. } state { items: set X } actions { action get(x: X) { -> ok(item: X) { Return. } } } }".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            ParseOutput::Ok { spec, ast, .. } => {
                assert_eq!(spec, s.clone());
                assert_eq!(ast, a.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // parse(source: "") -> error(message: m, line: 0)
        let step2 = handler.parse(
            ParseInput { source: "".to_string() },
            &storage,
        ).await.unwrap();
        match step2 {
            ParseOutput::Error { message, line, .. } => {
                assert_eq!(message, m.clone());
                assert_eq!(line, 0);
            },
            other => panic!("Expected Error, got {:?}", other),
        }
    }

}
