// generated: theme_entity/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::ThemeEntityHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn theme_entity_invariant_1() {
        // invariant 1: after register, get behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let t = "u-test-invariant-001".to_string();

        // --- AFTER clause ---
        // register(name: "light", source: "themes/light.theme", ast: "{}") -> ok(entity: t)
        let step1 = handler.register(
            RegisterInput { name: "light".to_string(), source: "themes/light.theme".to_string(), ast: "{}".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            RegisterOutput::Ok { entity, .. } => {
                assert_eq!(entity, t.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // get(name: "light") -> ok(entity: t)
        let step2 = handler.get(
            GetInput { name: "light".to_string() },
            &storage,
        ).await.unwrap();
        match step2 {
            GetOutput::Ok { entity, .. } => {
                assert_eq!(entity, t.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

    #[tokio::test]
    async fn theme_entity_invariant_2() {
        // invariant 2: after register, register behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let t = "u-test-invariant-001".to_string();

        // --- AFTER clause ---
        // register(name: "light", source: "themes/light.theme", ast: "{}") -> ok(entity: t)
        let step1 = handler.register(
            RegisterInput { name: "light".to_string(), source: "themes/light.theme".to_string(), ast: "{}".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            RegisterOutput::Ok { entity, .. } => {
                assert_eq!(entity, t.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // register(name: "light", source: "themes/light.theme", ast: "{}") -> alreadyRegistered(existing: t)
        let step2 = handler.register(
            RegisterInput { name: "light".to_string(), source: "themes/light.theme".to_string(), ast: "{}".to_string() },
            &storage,
        ).await.unwrap();
        match step2 {
            RegisterOutput::AlreadyRegistered { existing, .. } => {
                assert_eq!(existing, t.clone());
            },
            other => panic!("Expected AlreadyRegistered, got {:?}", other),
        }
    }

}
