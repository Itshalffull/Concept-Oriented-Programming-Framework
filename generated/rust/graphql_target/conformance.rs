// generated: graphql_target/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::GraphqlTargetHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn graphql_target_invariant_1() {
        // invariant 1: after generate, listOperations behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let t = "u-test-invariant-001".to_string();
        let f = "u-test-invariant-002".to_string();
        let q = "u-test-invariant-003".to_string();
        let m = "u-test-invariant-004".to_string();
        let s = "u-test-invariant-005".to_string();

        // --- AFTER clause ---
        // generate(projection: "order-projection", config: "{}") -> ok(types: t, files: f)
        let step1 = handler.generate(
            GenerateInput { projection: "order-projection".to_string(), config: "{}".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            GenerateOutput::Ok { types, files, .. } => {
                assert_eq!(types, t.clone());
                assert_eq!(files, f.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // listOperations(concept: "Order") -> ok(queries: q, mutations: m, subscriptions: s)
        let step2 = handler.list_operations(
            ListOperationsInput { concept: "Order".to_string() },
            &storage,
        ).await.unwrap();
        match step2 {
            ListOperationsOutput::Ok { queries, mutations, subscriptions, .. } => {
                assert_eq!(queries, q.clone());
                assert_eq!(mutations, m.clone());
                assert_eq!(subscriptions, s.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
