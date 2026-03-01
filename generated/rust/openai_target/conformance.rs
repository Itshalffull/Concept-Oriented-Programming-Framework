// generated: openai_target/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::OpenaiTargetHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn openai_target_invariant_1() {
        // invariant 1: after generate, listFunctions behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let f = "u-test-invariant-001".to_string();
        let fl = "u-test-invariant-002".to_string();
        let fns = "u-test-invariant-003".to_string();

        // --- AFTER clause ---
        // generate(projection: "score-projection", config: "{}") -> ok(functions: f, files: fl)
        let step1 = handler.generate(
            GenerateInput { projection: "score-projection".to_string(), config: "{}".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            GenerateOutput::Ok { functions, files, .. } => {
                assert_eq!(functions, f.clone());
                assert_eq!(files, fl.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // listFunctions(concept: "ScoreApi") -> ok(functions: fns)
        let step2 = handler.list_functions(
            ListFunctionsInput { concept: "ScoreApi".to_string() },
            &storage,
        ).await.unwrap();
        match step2 {
            ListFunctionsOutput::Ok { functions, .. } => {
                assert_eq!(functions, fns.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
