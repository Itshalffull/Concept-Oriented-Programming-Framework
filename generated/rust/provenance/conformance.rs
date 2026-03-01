// generated: provenance/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::ProvenanceHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn provenance_invariant_1() {
        // invariant 1: after record, trace behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        // --- AFTER clause ---
        // record(entity: "item-1", activity: "capture", agent: "system", inputs: "") -> ok(recordId: "prov-1")
        let step1 = handler.record(
            RecordInput { entity: "item-1".to_string(), activity: "capture".to_string(), agent: "system".to_string(), inputs: "".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            RecordOutput::Ok { record_id, .. } => {
                assert_eq!(record_id, "prov-1".to_string());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // trace(entityId: "item-1") -> ok(chain: "[{\"activity\":\"capture\",\"agent\":\"system\"}]")
        let step2 = handler.trace(
            TraceInput { entity_id: "item-1".to_string() },
            &storage,
        ).await.unwrap();
        match step2 {
            TraceOutput::Ok { chain, .. } => {
                assert_eq!(chain, "[{"activity":"capture","agent":"system"}]".to_string());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

    #[tokio::test]
    async fn provenance_invariant_2() {
        // invariant 2: after record, rollback behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        // --- AFTER clause ---
        // record(entity: "item-1", activity: "import", agent: "system", inputs: "") -> ok(recordId: "prov-batch-1")
        let step1 = handler.record(
            RecordInput { entity: "item-1".to_string(), activity: "import".to_string(), agent: "system".to_string(), inputs: "".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            RecordOutput::Ok { record_id, .. } => {
                assert_eq!(record_id, "prov-batch-1".to_string());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // rollback(batchId: "batch-1") -> ok(rolled: 1)
        let step2 = handler.rollback(
            RollbackInput { batch_id: "batch-1".to_string() },
            &storage,
        ).await.unwrap();
        match step2 {
            RollbackOutput::Ok { rolled, .. } => {
                assert_eq!(rolled, 1);
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
