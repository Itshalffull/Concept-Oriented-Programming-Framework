// generated: analysis_rule/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::AnalysisRuleHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn analysis_rule_invariant_1() {
        // invariant 1: after create, get behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let u = "u-test-invariant-001".to_string();

        // --- AFTER clause ---
        // create(name: "dead-variants", engine: "graph-traversal", source: "...", severity: "warning", category: "dead-code") -> ok(rule: u)
        let step1 = handler.create(
            CreateInput { name: "dead-variants".to_string(), engine: "graph-traversal".to_string(), source: "...".to_string(), severity: "warning".to_string(), category: "dead-code".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            CreateOutput::Ok { rule, .. } => {
                assert_eq!(rule, u.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // get(rule: u) -> ok(rule: u, name: "dead-variants", engine: "graph-traversal", severity: "warning", category: "dead-code")
        let step2 = handler.get(
            GetInput { rule: u.clone() },
            &storage,
        ).await.unwrap();
        match step2 {
            GetOutput::Ok { rule, name, engine, severity, category, .. } => {
                assert_eq!(rule, u.clone());
                assert_eq!(name, "dead-variants".to_string());
                assert_eq!(engine, "graph-traversal".to_string());
                assert_eq!(severity, "warning".to_string());
                assert_eq!(category, "dead-code".to_string());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
