// generated: solidity_gen/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::SolidityGenHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn solidity_gen_invariant_1() {
        // invariant 1: after generate, generate behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let f = "u-test-invariant-001".to_string();
        let e = "u-test-invariant-002".to_string();

        // --- AFTER clause ---
        // generate(spec: "s1", manifest: { name: "Ping", uri: "urn:clef/Ping", typeParams: [], relations: [], actions: [{ name: "ping", params: [], variants: [{ tag: "ok", fields: [], prose: "Pong." }] }], invariants: [], graphqlSchema: "", jsonSchemas: { invocations: {  }, completions: {  } }, capabilities: [], purpose: "A test." }) -> ok(files: f)
        let step1 = handler.generate(
            GenerateInput { spec: "s1".to_string(), manifest: todo!(/* record: { "name": "Ping".to_string(), "uri": "urn:clef/Ping".to_string(), "typeParams": todo!(/* list: [] */), "relations": todo!(/* list: [] */), "actions": todo!(/* list: [todo!(/* record: { "name": "ping".to_string(), "params": todo!(/* list: [] */), "variants": todo!(/* list: [todo!(/* record: { "tag": "ok".to_string(), "fields": todo!(/* list: [] */), "prose": "Pong.".to_string() } */)] */) } */)] */), "invariants": todo!(/* list: [] */), "graphqlSchema": "".to_string(), "jsonSchemas": todo!(/* record: { "invocations": todo!(/* record: {  } */), "completions": todo!(/* record: {  } */) } */), "capabilities": todo!(/* list: [] */), "purpose": "A test.".to_string() } */) },
            &storage,
        ).await.unwrap();
        match step1 {
            GenerateOutput::Ok { files, .. } => {
                assert_eq!(files, f.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // generate(spec: "s2", manifest: { name: "" }) -> error(message: e)
        let step2 = handler.generate(
            GenerateInput { spec: "s2".to_string(), manifest: todo!(/* record: { "name": "".to_string() } */) },
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
