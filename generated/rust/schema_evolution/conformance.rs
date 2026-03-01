// generated: schema_evolution/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::SchemaEvolutionHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn schema_evolution_invariant_1() {
        // invariant 1: after register, check behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let s = "u-test-invariant-001".to_string();
        let sc = "u-test-invariant-002".to_string();
        let v = "u-test-invariant-003".to_string();
        let sid = "u-test-invariant-004".to_string();
        let prev = "u-test-invariant-005".to_string();

        // --- AFTER clause ---
        // register(subject: s, schema: sc, compatibility: "full") -> ok(version: v, schemaId: sid)
        let step1 = handler.register(
            RegisterInput { subject: s.clone(), schema: sc.clone(), compatibility: "full".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            RegisterOutput::Ok { version, schema_id, .. } => {
                assert_eq!(version, v.clone());
                assert_eq!(schema_id, sid.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // check(oldSchema: prev, newSchema: sc, mode: "full") -> compatible()
        let step2 = handler.check(
            CheckInput { old_schema: prev.clone(), new_schema: sc.clone(), mode: "full".to_string() },
            &storage,
        ).await.unwrap();
        assert!(matches!(step2, CheckOutput::Compatible));
    }

}
