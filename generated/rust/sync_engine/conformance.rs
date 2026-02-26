// generated: sync_engine/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::SyncEngineHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn sync_engine_invariant_1() {
        // invariant 1: after registerSync, onCompletion behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let inv = "u-test-invariant-001".to_string();

        // --- AFTER clause ---
        // registerSync(sync: { name: "TestSync", annotations: ["eager"], when: [{ concept: "urn:clef/Test", action: "act", inputFields: [], outputFields: [] }], where: [], then: [{ concept: "urn:clef/Other", action: "do", fields: [] }] }) -> ok()
        let step1 = handler.register_sync(
            RegisterSyncInput { sync: todo!(/* record: { "name": "TestSync".to_string(), "annotations": todo!(/* list: ["eager".to_string()] */), "when": todo!(/* list: [todo!(/* record: { "concept": "urn:clef/Test".to_string(), "action": "act".to_string(), "inputFields": todo!(/* list: [] */), "outputFields": todo!(/* list: [] */) } */)] */), "where": todo!(/* list: [] */), "then": todo!(/* list: [todo!(/* record: { "concept": "urn:clef/Other".to_string(), "action": "do".to_string(), "fields": todo!(/* list: [] */) } */)] */) } */) },
            &storage,
        ).await.unwrap();
        assert!(matches!(step1, RegisterSyncOutput::Ok));

        // --- THEN clause ---
        // onCompletion(completion: { id: "c1", concept: "urn:clef/Test", action: "act", input: {  }, variant: "ok", output: {  }, flow: "f1", timestamp: "2024-01-01T00:00:00Z" }) -> ok(invocations: inv)
        let step2 = handler.on_completion(
            OnCompletionInput { completion: todo!(/* record: { "id": "c1".to_string(), "concept": "urn:clef/Test".to_string(), "action": "act".to_string(), "input": todo!(/* record: {  } */), "variant": "ok".to_string(), "output": todo!(/* record: {  } */), "flow": "f1".to_string(), "timestamp": "2024-01-01T00:00:00Z".to_string() } */) },
            &storage,
        ).await.unwrap();
        match step2 {
            OnCompletionOutput::Ok { invocations, .. } => {
                assert_eq!(invocations, inv.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
