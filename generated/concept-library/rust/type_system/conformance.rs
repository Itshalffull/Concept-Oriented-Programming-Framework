// generated: type_system/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::TypeSystemHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn type_system_invariant_1() {
        // invariant 1: after registerType, resolve behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let t = "u-test-invariant-001".to_string();

        // --- AFTER clause ---
        // registerType(type: t, schema: "{\"type\":\"string\"}", constraints: "{}") -> ok(type: t)
        let step1 = handler.register_type(
            RegisterTypeInput { type: t.clone(), schema: "{"type":"string"}".to_string(), constraints: "{}".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            RegisterTypeOutput::Ok { type, .. } => {
                assert_eq!(type, t.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // resolve(type: t) -> ok(type: t, schema: "{\"type\":\"string\"}")
        let step2 = handler.resolve(
            ResolveInput { type: t.clone() },
            &storage,
        ).await.unwrap();
        match step2 {
            ResolveOutput::Ok { type, schema, .. } => {
                assert_eq!(type, t.clone());
                assert_eq!(schema, "{"type":"string"}".to_string());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

    #[tokio::test]
    async fn type_system_invariant_2() {
        // invariant 2: after registerType, registerType behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let t = "u-test-invariant-001".to_string();

        // --- AFTER clause ---
        // registerType(type: t, schema: "{\"type\":\"string\"}", constraints: "{}") -> ok(type: t)
        let step1 = handler.register_type(
            RegisterTypeInput { type: t.clone(), schema: "{"type":"string"}".to_string(), constraints: "{}".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            RegisterTypeOutput::Ok { type, .. } => {
                assert_eq!(type, t.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // registerType(type: t, schema: "{\"type\":\"number\"}", constraints: "{}") -> exists(message: "already exists")
        let step2 = handler.register_type(
            RegisterTypeInput { type: t.clone(), schema: "{"type":"number"}".to_string(), constraints: "{}".to_string() },
            &storage,
        ).await.unwrap();
        match step2 {
            RegisterTypeOutput::Exists { message, .. } => {
                assert_eq!(message, "already exists".to_string());
            },
            other => panic!("Expected Exists, got {:?}", other),
        }
    }

}
