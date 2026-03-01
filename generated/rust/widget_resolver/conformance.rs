// generated: widget_resolver/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::WidgetResolverHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn widget_resolver_invariant_1() {
        // invariant 1: after resolve, explain behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let r = "u-test-invariant-001".to_string();

        // --- AFTER clause ---
        // resolve(resolver: r, element: "{ \"interactorType\": \"single-choice\", \"optionCount\": 4 }", context: "{ \"platform\": \"browser\", \"viewport\": \"desktop\" }") -> ok(resolver: r, widget: "radio-group", score: _, reason: _)
        let step1 = handler.resolve(
            ResolveInput { resolver: r.clone(), element: "{ "interactorType": "single-choice", "optionCount": 4 }".to_string(), context: "{ "platform": "browser", "viewport": "desktop" }".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            ResolveOutput::Ok { resolver, widget, score, reason, .. } => {
                assert_eq!(resolver, r.clone());
                assert_eq!(widget, "radio-group".to_string());
                assert_eq!(score, .clone());
                assert_eq!(reason, .clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // explain(resolver: r, element: "{ \"interactorType\": \"single-choice\", \"optionCount\": 4 }", context: "{ \"platform\": \"browser\", \"viewport\": \"desktop\" }") -> ok(resolver: r, explanation: _)
        let step2 = handler.explain(
            ExplainInput { resolver: r.clone(), element: "{ "interactorType": "single-choice", "optionCount": 4 }".to_string(), context: "{ "platform": "browser", "viewport": "desktop" }".to_string() },
            &storage,
        ).await.unwrap();
        match step2 {
            ExplainOutput::Ok { resolver, explanation, .. } => {
                assert_eq!(resolver, r.clone());
                assert_eq!(explanation, .clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

    #[tokio::test]
    async fn widget_resolver_invariant_2() {
        // invariant 2: after override, resolve behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let r = "u-test-invariant-001".to_string();

        // --- AFTER clause ---
        // override(resolver: r, element: "{ \"kind\": \"selection-single\" }", widget: "custom-picker") -> ok(resolver: r)
        let step1 = handler.override(
            OverrideInput { resolver: r.clone(), element: "{ "kind": "selection-single" }".to_string(), widget: "custom-picker".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            OverrideOutput::Ok { resolver, .. } => {
                assert_eq!(resolver, r.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // resolve(resolver: r, element: "{ \"kind\": \"selection-single\" }", context: _) -> ok(resolver: r, widget: "custom-picker", score: _, reason: _)
        let step2 = handler.resolve(
            ResolveInput { resolver: r.clone(), element: "{ "kind": "selection-single" }".to_string(), context: .clone() },
            &storage,
        ).await.unwrap();
        match step2 {
            ResolveOutput::Ok { resolver, widget, score, reason, .. } => {
                assert_eq!(resolver, r.clone());
                assert_eq!(widget, "custom-picker".to_string());
                assert_eq!(score, .clone());
                assert_eq!(reason, .clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
