// generated: widget_prop_entity/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::WidgetPropEntityHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn widget_prop_entity_invariant_1() {
        // invariant 1: after register, get behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let p = "u-test-invariant-001".to_string();

        // --- AFTER clause ---
        // register(widget: "dialog", name: "closeOnEscape", typeExpr: "Bool", defaultValue: "true") -> ok(prop: p)
        let step1 = handler.register(
            RegisterInput { widget: "dialog".to_string(), name: "closeOnEscape".to_string(), type_expr: "Bool".to_string(), default_value: "true".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            RegisterOutput::Ok { prop, .. } => {
                assert_eq!(prop, p.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // get(prop: p) -> ok(prop: p, widget: "dialog", name: "closeOnEscape", typeExpr: "Bool", defaultValue: "true")
        let step2 = handler.get(
            GetInput { prop: p.clone() },
            &storage,
        ).await.unwrap();
        match step2 {
            GetOutput::Ok { prop, widget, name, type_expr, default_value, .. } => {
                assert_eq!(prop, p.clone());
                assert_eq!(widget, "dialog".to_string());
                assert_eq!(name, "closeOnEscape".to_string());
                assert_eq!(type_expr, "Bool".to_string());
                assert_eq!(default_value, "true".to_string());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
