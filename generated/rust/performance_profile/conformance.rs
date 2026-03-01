// generated: performance_profile/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::PerformanceProfileHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn performance_profile_invariant_1() {
        // invariant 1: after aggregate, get behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let p = "u-test-invariant-001".to_string();

        // --- AFTER clause ---
        // aggregate(symbol: "clef/action/Article/create", window: "{}") -> ok(profile: p)
        let step1 = handler.aggregate(
            AggregateInput { symbol: "clef/action/Article/create".to_string(), window: "{}".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            AggregateOutput::Ok { profile, .. } => {
                assert_eq!(profile, p.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // get(profile: p) -> ok(profile: p, entitySymbol: "clef/action/Article/create", entityKind: _, invocationCount: _, errorRate: _)
        let step2 = handler.get(
            GetInput { profile: p.clone() },
            &storage,
        ).await.unwrap();
        match step2 {
            GetOutput::Ok { profile, entity_symbol, entity_kind, invocation_count, error_rate, .. } => {
                assert_eq!(profile, p.clone());
                assert_eq!(entity_symbol, "clef/action/Article/create".to_string());
                assert_eq!(entity_kind, .clone());
                assert_eq!(invocation_count, .clone());
                assert_eq!(error_rate, .clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
