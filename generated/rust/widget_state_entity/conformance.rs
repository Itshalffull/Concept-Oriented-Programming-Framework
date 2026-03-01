// generated: widget_state_entity/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::WidgetStateEntityHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn widget_state_entity_invariant_1() {
        // invariant 1: after register, get behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let s = "u-test-invariant-001".to_string();

        // --- AFTER clause ---
        // register(widget: "dialog", name: "closed", initial: "true") -> ok(widgetState: s)
        let step1 = handler.register(
            RegisterInput { widget: "dialog".to_string(), name: "closed".to_string(), initial: "true".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            RegisterOutput::Ok { widget_state, .. } => {
                assert_eq!(widget_state, s.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // get(widgetState: s) -> ok(widgetState: s, widget: "dialog", name: "closed", initial: "true", transitionCount: _)
        let step2 = handler.get(
            GetInput { widget_state: s.clone() },
            &storage,
        ).await.unwrap();
        match step2 {
            GetOutput::Ok { widget_state, widget, name, initial, transition_count, .. } => {
                assert_eq!(widget_state, s.clone());
                assert_eq!(widget, "dialog".to_string());
                assert_eq!(name, "closed".to_string());
                assert_eq!(initial, "true".to_string());
                assert_eq!(transition_count, .clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
