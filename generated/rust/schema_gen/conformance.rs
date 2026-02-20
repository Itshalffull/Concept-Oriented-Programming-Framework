// generated: schema_gen/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::SchemaGenHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn schema_gen_invariant_1() {
        // invariant 1: after generate, generate behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let m = "u-test-invariant-001".to_string();
        let e = "u-test-invariant-002".to_string();

        // --- AFTER clause ---
        // generate(spec: "s1", ast: { name: "Ping", typeParams: ["T"], purpose: "A test.", state: [], actions: [{ name: "ping", params: [], variants: [{ name: "ok", params: [], description: "Pong." }] }], invariants: [], capabilities: [] }) -> ok(manifest: m)
        let step1 = handler.generate(
            GenerateInput { spec: "s1".to_string(), ast: todo!(/* record: { "name": "Ping".to_string(), "typeParams": todo!(/* list: ["T".to_string()] */), "purpose": "A test.".to_string(), "state": todo!(/* list: [] */), "actions": todo!(/* list: [todo!(/* record: { "name": "ping".to_string(), "params": todo!(/* list: [] */), "variants": todo!(/* list: [todo!(/* record: { "name": "ok".to_string(), "params": todo!(/* list: [] */), "description": "Pong.".to_string() } */)] */) } */)] */), "invariants": todo!(/* list: [] */), "capabilities": todo!(/* list: [] */) } */) },
            &storage,
        ).await.unwrap();
        match step1 {
            GenerateOutput::Ok { manifest, .. } => {
                assert_eq!(manifest, m.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // generate(spec: "s2", ast: { name: "" }) -> error(message: e)
        let step2 = handler.generate(
            GenerateInput { spec: "s2".to_string(), ast: todo!(/* record: { "name": "".to_string() } */) },
            &storage,
        ).await.unwrap();
        match step2 {
            GenerateOutput::Error { message, .. } => {
                assert_eq!(message, e.clone());
            },
            other => panic!("Expected Error, got {:?}", other),
        }
    }

}
