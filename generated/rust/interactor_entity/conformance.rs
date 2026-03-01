// generated: interactor_entity/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::InteractorEntityHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn interactor_entity_invariant_1() {
        // invariant 1: after register, get behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let i = "u-test-invariant-001".to_string();

        // --- AFTER clause ---
        // register(name: "single-choice", category: "selection", properties: "{}") -> ok(entity: i)
        let step1 = handler.register(
            RegisterInput { name: "single-choice".to_string(), category: "selection".to_string(), properties: "{}".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            RegisterOutput::Ok { entity, .. } => {
                assert_eq!(entity, i.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // get(interactor: i) -> ok(interactor: i, name: "single-choice", category: "selection", properties: "{}")
        let step2 = handler.get(
            GetInput { interactor: i.clone() },
            &storage,
        ).await.unwrap();
        match step2 {
            GetOutput::Ok { interactor, name, category, properties, .. } => {
                assert_eq!(interactor, i.clone());
                assert_eq!(name, "single-choice".to_string());
                assert_eq!(category, "selection".to_string());
                assert_eq!(properties, "{}".to_string());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
