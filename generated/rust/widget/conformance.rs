// generated: widget/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::WidgetHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn widget_invariant_1() {
        // invariant 1: after register, get behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let p = "u-test-invariant-001".to_string();

        // --- AFTER clause ---
        // register(widget: p, name: "dialog", ast: _, category: "overlay") -> ok(widget: p)
        let step1 = handler.register(
            RegisterInput { widget: p.clone(), name: "dialog".to_string(), ast: .clone(), category: "overlay".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            RegisterOutput::Ok { widget, .. } => {
                assert_eq!(widget, p.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // get(widget: p) -> ok(widget: p, ast: _, name: "dialog")
        let step2 = handler.get(
            GetInput { widget: p.clone() },
            &storage,
        ).await.unwrap();
        match step2 {
            GetOutput::Ok { widget, ast, name, .. } => {
                assert_eq!(widget, p.clone());
                assert_eq!(ast, .clone());
                assert_eq!(name, "dialog".to_string());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
