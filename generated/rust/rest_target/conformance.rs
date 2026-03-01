// generated: rest_target/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::RestTargetHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn rest_target_invariant_1() {
        // invariant 1: after generate, listRoutes behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let r = "u-test-invariant-001".to_string();
        let f = "u-test-invariant-002".to_string();
        let lr = "u-test-invariant-003".to_string();
        let m = "u-test-invariant-004".to_string();

        // --- AFTER clause ---
        // generate(projection: "user-projection", config: "{}") -> ok(routes: r, files: f)
        let step1 = handler.generate(
            GenerateInput { projection: "user-projection".to_string(), config: "{}".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            GenerateOutput::Ok { routes, files, .. } => {
                assert_eq!(routes, r.clone());
                assert_eq!(files, f.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // listRoutes(concept: "User") -> ok(routes: lr, methods: m)
        let step2 = handler.list_routes(
            ListRoutesInput { concept: "User".to_string() },
            &storage,
        ).await.unwrap();
        match step2 {
            ListRoutesOutput::Ok { routes, methods, .. } => {
                assert_eq!(routes, lr.clone());
                assert_eq!(methods, m.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
