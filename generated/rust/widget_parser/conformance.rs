// generated: widget_parser/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::WidgetParserHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn widget_parser_invariant_1() {
        // invariant 1: after parse, validate behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let w = "u-test-invariant-001".to_string();

        // --- AFTER clause ---
        // parse(widget: w, source: "widget button { ... }") -> ok(widget: w, ast: _)
        let step1 = handler.parse(
            ParseInput { widget: w.clone(), source: "widget button { ... }".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            ParseOutput::Ok { widget, ast, .. } => {
                assert_eq!(widget, w.clone());
                assert_eq!(ast, .clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // validate(widget: w) -> ok(widget: w)
        let step2 = handler.validate(
            ValidateInput { widget: w.clone() },
            &storage,
        ).await.unwrap();
        match step2 {
            ValidateOutput::Ok { widget, .. } => {
                assert_eq!(widget, w.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
