// generated: widget_entity/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::WidgetEntityHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn widget_entity_invariant_1() {
        // invariant 1: after register, get behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let w = "u-test-invariant-001".to_string();

        // --- AFTER clause ---
        // register(name: "dialog", source: "widgets/dialog.widget", ast: "{}") -> ok(entity: w)
        let step1 = handler.register(
            RegisterInput { name: "dialog".to_string(), source: "widgets/dialog.widget".to_string(), ast: "{}".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            RegisterOutput::Ok { entity, .. } => {
                assert_eq!(entity, w.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // get(name: "dialog") -> ok(entity: w)
        let step2 = handler.get(
            GetInput { name: "dialog".to_string() },
            &storage,
        ).await.unwrap();
        match step2 {
            GetOutput::Ok { entity, .. } => {
                assert_eq!(entity, w.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

    #[tokio::test]
    async fn widget_entity_invariant_2() {
        // invariant 2: after register, register behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let w = "u-test-invariant-001".to_string();

        // --- AFTER clause ---
        // register(name: "dialog", source: "widgets/dialog.widget", ast: "{}") -> ok(entity: w)
        let step1 = handler.register(
            RegisterInput { name: "dialog".to_string(), source: "widgets/dialog.widget".to_string(), ast: "{}".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            RegisterOutput::Ok { entity, .. } => {
                assert_eq!(entity, w.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // register(name: "dialog", source: "widgets/dialog.widget", ast: "{}") -> alreadyRegistered(existing: w)
        let step2 = handler.register(
            RegisterInput { name: "dialog".to_string(), source: "widgets/dialog.widget".to_string(), ast: "{}".to_string() },
            &storage,
        ).await.unwrap();
        match step2 {
            RegisterOutput::AlreadyRegistered { existing, .. } => {
                assert_eq!(existing, w.clone());
            },
            other => panic!("Expected AlreadyRegistered, got {:?}", other),
        }
    }

}
