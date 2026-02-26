// generated: exposed_filter/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::ExposedFilterHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn exposed_filter_invariant_1() {
        // invariant 1: after expose, collectInput, applyToQuery behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let f = "u-test-invariant-001".to_string();
        let m = "u-test-invariant-002".to_string();

        // --- AFTER clause ---
        // expose(filter: f, fieldName: "status", operator: "eq", defaultValue: "active") -> ok(filter: f)
        let step1 = handler.expose(
            ExposeInput { filter: f.clone(), field_name: "status".to_string(), operator: "eq".to_string(), default_value: "active".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            ExposeOutput::Ok { filter, .. } => {
                assert_eq!(filter, f.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // collectInput(filter: f, value: "archived") -> ok(filter: f)
        let step2 = handler.collect_input(
            CollectInputInput { filter: f.clone(), value: "archived".to_string() },
            &storage,
        ).await.unwrap();
        match step2 {
            CollectInputOutput::Ok { filter, .. } => {
                assert_eq!(filter, f.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
        // applyToQuery(filter: f) -> ok(queryMod: m)
        let step3 = handler.apply_to_query(
            ApplyToQueryInput { filter: f.clone() },
            &storage,
        ).await.unwrap();
        match step3 {
            ApplyToQueryOutput::Ok { query_mod, .. } => {
                assert_eq!(query_mod, m.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
