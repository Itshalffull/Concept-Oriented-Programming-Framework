// generated: navigator/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::NavigatorHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn navigator_invariant_1() {
        // invariant 1: after register, go behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let n = "u-test-invariant-001".to_string();

        // --- AFTER clause ---
        // register(nav: n, name: "detail", targetConcept: "Article", targetView: "detail", paramsSchema: _, meta: _) -> ok(nav: n)
        let step1 = handler.register(
            RegisterInput { nav: n.clone(), name: "detail".to_string(), target_concept: "Article".to_string(), target_view: "detail".to_string(), params_schema: .clone(), meta: .clone() },
            &storage,
        ).await.unwrap();
        match step1 {
            RegisterOutput::Ok { nav, .. } => {
                assert_eq!(nav, n.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // go(nav: n, params: _) -> ok(nav: n, previous: _)
        let step2 = handler.go(
            GoInput { nav: n.clone(), params: .clone() },
            &storage,
        ).await.unwrap();
        match step2 {
            GoOutput::Ok { nav, previous, .. } => {
                assert_eq!(nav, n.clone());
                assert_eq!(previous, .clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

    #[tokio::test]
    async fn navigator_invariant_2() {
        // invariant 2: after go, back behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let a = "u-test-invariant-001".to_string();
        let b = "u-test-invariant-002".to_string();

        // --- AFTER clause ---
        // go(nav: a, params: _) -> ok(nav: a, previous: _)
        let step1 = handler.go(
            GoInput { nav: a.clone(), params: .clone() },
            &storage,
        ).await.unwrap();
        match step1 {
            GoOutput::Ok { nav, previous, .. } => {
                assert_eq!(nav, a.clone());
                assert_eq!(previous, .clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // back(nav: b) -> ok(nav: b, previous: _)
        let step2 = handler.back(
            BackInput { nav: b.clone() },
            &storage,
        ).await.unwrap();
        match step2 {
            BackOutput::Ok { nav, previous, .. } => {
                assert_eq!(nav, b.clone());
                assert_eq!(previous, .clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
