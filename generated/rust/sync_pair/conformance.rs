// generated: sync_pair/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::SyncPairHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn sync_pair_invariant_1() {
        // invariant 1: after link, sync behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        // --- AFTER clause ---
        // link(pairId: "pair-1", idA: "local-1", idB: "remote-1") -> ok()
        let step1 = handler.link(
            LinkInput { pair_id: "pair-1".to_string(), id_a: "local-1".to_string(), id_b: "remote-1".to_string() },
            &storage,
        ).await.unwrap();
        assert!(matches!(step1, LinkOutput::Ok));

        // --- THEN clause ---
        // sync(pairId: "pair-1") -> ok(changes: "[{\"entity\":\"local-1\",\"op\":\"update\"}]")
        let step2 = handler.sync(
            SyncInput { pair_id: "pair-1".to_string() },
            &storage,
        ).await.unwrap();
        match step2 {
            SyncOutput::Ok { changes, .. } => {
                assert_eq!(changes, "[{"entity":"local-1","op":"update"}]".to_string());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
