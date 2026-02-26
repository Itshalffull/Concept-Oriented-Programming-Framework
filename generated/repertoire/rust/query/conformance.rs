// generated: query/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::QueryHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn query_invariant_1() {
        // invariant 1: after parse, execute behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let q = "u-test-invariant-001".to_string();
        let r = "u-test-invariant-002".to_string();

        // --- AFTER clause ---
        // parse(query: q, expression: "status = 'active'") -> ok(query: q)
        let step1 = handler.parse(
            ParseInput { query: q.clone(), expression: "status = 'active'".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            ParseOutput::Ok { query, .. } => {
                assert_eq!(query, q.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // execute(query: q) -> ok(results: r)
        let step2 = handler.execute(
            ExecuteInput { query: q.clone() },
            &storage,
        ).await.unwrap();
        match step2 {
            ExecuteOutput::Ok { results, .. } => {
                assert_eq!(results, r.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
