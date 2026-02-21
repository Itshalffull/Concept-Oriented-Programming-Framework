// generated: pathauto/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::PathautoHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn pathauto_invariant_1() {
        // invariant 1: after generateAlias, cleanString behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let p = "u-test-invariant-001".to_string();
        let a = "u-test-invariant-002".to_string();

        // --- AFTER clause ---
        // generateAlias(pattern: p, entity: "My Example Page") -> ok(alias: a)
        let step1 = handler.generate_alias(
            GenerateAliasInput { pattern: p.clone(), entity: "My Example Page".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            GenerateAliasOutput::Ok { alias, .. } => {
                assert_eq!(alias, a.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // cleanString(input: "My Example Page") -> ok(cleaned: a)
        let step2 = handler.clean_string(
            CleanStringInput { input: "My Example Page".to_string() },
            &storage,
        ).await.unwrap();
        match step2 {
            CleanStringOutput::Ok { cleaned, .. } => {
                assert_eq!(cleaned, a.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
