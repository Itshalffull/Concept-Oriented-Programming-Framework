// generated: sync_parser/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::SyncParserHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn sync_parser_invariant_1() {
        // invariant 1: after parse, parse behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let s = "u-test-invariant-001".to_string();
        let a = "u-test-invariant-002".to_string();
        let e = "u-test-invariant-003".to_string();

        // --- AFTER clause ---
        // parse(source: "sync T [eager]\nwhen {\n  A/act: [ x: ?v ] => []\n}\nthen {\n  B/do: [ x: ?v ]\n}", manifests: []) -> ok(sync: s, ast: a)
        let step1 = handler.parse(
            ParseInput { source: "sync T [eager]
when {
  A/act: [ x: ?v ] => []
}
then {
  B/do: [ x: ?v ]
}".to_string(), manifests: todo!(/* list: [] */) },
            &storage,
        ).await.unwrap();
        match step1 {
            ParseOutput::Ok { sync, ast, .. } => {
                assert_eq!(sync, s.clone());
                assert_eq!(ast, a.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // parse(source: "invalid", manifests: []) -> error(message: e, line: 0)
        let step2 = handler.parse(
            ParseInput { source: "invalid".to_string(), manifests: todo!(/* list: [] */) },
            &storage,
        ).await.unwrap();
        match step2 {
            ParseOutput::Error { message, line, .. } => {
                assert_eq!(message, e.clone());
                assert_eq!(line, 0);
            },
            other => panic!("Expected Error, got {:?}", other),
        }
    }

}
