// generated: content_parser/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::ContentParserHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn content_parser_invariant_1() {
        // invariant 1: after registerFormat, parse, extractTags behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let c = "u-test-invariant-001".to_string();
        let a = "u-test-invariant-002".to_string();
        let t = "u-test-invariant-003".to_string();

        // --- AFTER clause ---
        // registerFormat(name: "markdown", grammar: "{}") -> ok(name: "markdown")
        let step1 = handler.register_format(
            RegisterFormatInput { name: "markdown".to_string(), grammar: "{}".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            RegisterFormatOutput::Ok { name, .. } => {
                assert_eq!(name, "markdown".to_string());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
        // parse(content: c, text: "Hello #tag [[ref]]", format: "markdown") -> ok(ast: a)
        let step2 = handler.parse(
            ParseInput { content: c.clone(), text: "Hello #tag [[ref]]".to_string(), format: "markdown".to_string() },
            &storage,
        ).await.unwrap();
        match step2 {
            ParseOutput::Ok { ast, .. } => {
                assert_eq!(ast, a.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // extractTags(content: c) -> ok(tags: t)
        let step3 = handler.extract_tags(
            ExtractTagsInput { content: c.clone() },
            &storage,
        ).await.unwrap();
        match step3 {
            ExtractTagsOutput::Ok { tags, .. } => {
                assert_eq!(tags, t.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
