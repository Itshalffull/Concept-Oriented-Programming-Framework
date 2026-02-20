// generated: sync_compiler/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::SyncCompilerHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn sync_compiler_invariant_1() {
        // invariant 1: after compile, compile behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let c = "u-test-invariant-001".to_string();
        let e = "u-test-invariant-002".to_string();

        // --- AFTER clause ---
        // compile(sync: "s1", ast: { name: "TestSync", annotations: [], when: [{ concept: "urn:copf/A", action: "act", inputFields: [], outputFields: [] }], where: [], then: [{ concept: "urn:copf/B", action: "do", fields: [] }] }) -> ok(compiled: c)
        let step1 = handler.compile(
            CompileInput { sync: "s1".to_string(), ast: todo!(/* record: { "name": "TestSync".to_string(), "annotations": todo!(/* list: [] */), "when": todo!(/* list: [todo!(/* record: { "concept": "urn:copf/A".to_string(), "action": "act".to_string(), "inputFields": todo!(/* list: [] */), "outputFields": todo!(/* list: [] */) } */)] */), "where": todo!(/* list: [] */), "then": todo!(/* list: [todo!(/* record: { "concept": "urn:copf/B".to_string(), "action": "do".to_string(), "fields": todo!(/* list: [] */) } */)] */) } */) },
            &storage,
        ).await.unwrap();
        match step1 {
            CompileOutput::Ok { compiled, .. } => {
                assert_eq!(compiled, c.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // compile(sync: "s2", ast: { name: "Bad", annotations: [], when: [{ concept: "urn:copf/A", action: "act", inputFields: [], outputFields: [] }], where: [], then: [] }) -> error(message: e)
        let step2 = handler.compile(
            CompileInput { sync: "s2".to_string(), ast: todo!(/* record: { "name": "Bad".to_string(), "annotations": todo!(/* list: [] */), "when": todo!(/* list: [todo!(/* record: { "concept": "urn:copf/A".to_string(), "action": "act".to_string(), "inputFields": todo!(/* list: [] */), "outputFields": todo!(/* list: [] */) } */)] */), "where": todo!(/* list: [] */), "then": todo!(/* list: [] */) } */) },
            &storage,
        ).await.unwrap();
        match step2 {
            CompileOutput::Error { message, .. } => {
                assert_eq!(message, e.clone());
            },
            other => panic!("Expected Error, got {:?}", other),
        }
    }

}
