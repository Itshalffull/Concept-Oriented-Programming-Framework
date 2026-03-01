// generated: chain_monitor/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::ChainMonitorHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn chain_monitor_invariant_1() {
        // invariant 1: after awaitFinality, status behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let tx = "u-test-invariant-001".to_string();

        // --- AFTER clause ---
        // awaitFinality(txHash: tx, level: "confirmations") -> ok(chain: "ethereum", block: 100, confirmations: 12)
        let step1 = handler.await_finality(
            AwaitFinalityInput { tx_hash: tx.clone(), level: "confirmations".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            AwaitFinalityOutput::Ok { chain, block, confirmations, .. } => {
                assert_eq!(chain, "ethereum".to_string());
                assert_eq!(block, 100);
                assert_eq!(confirmations, 12);
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // status(txHash: tx) -> ok(chain: "ethereum", block: 100, confirmations: 12)
        let step2 = handler.status(
            StatusInput { tx_hash: tx.clone() },
            &storage,
        ).await.unwrap();
        match step2 {
            StatusOutput::Ok { chain, block, confirmations, .. } => {
                assert_eq!(chain, "ethereum".to_string());
                assert_eq!(block, 100);
                assert_eq!(confirmations, 12);
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

    #[tokio::test]
    async fn chain_monitor_invariant_2() {
        // invariant 2: after awaitFinality, status behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let tx = "u-test-invariant-001".to_string();

        // --- AFTER clause ---
        // awaitFinality(txHash: tx, level: "confirmations") -> reorged(txHash: tx, depth: 3)
        let step1 = handler.await_finality(
            AwaitFinalityInput { tx_hash: tx.clone(), level: "confirmations".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            AwaitFinalityOutput::Reorged { tx_hash, depth, .. } => {
                assert_eq!(tx_hash, tx.clone());
                assert_eq!(depth, 3);
            },
            other => panic!("Expected Reorged, got {:?}", other),
        }

        // --- THEN clause ---
        // status(txHash: tx) -> ok(chain: "ethereum", block: 100, confirmations: 0)
        let step2 = handler.status(
            StatusInput { tx_hash: tx.clone() },
            &storage,
        ).await.unwrap();
        match step2 {
            StatusOutput::Ok { chain, block, confirmations, .. } => {
                assert_eq!(chain, "ethereum".to_string());
                assert_eq!(block, 100);
                assert_eq!(confirmations, 0);
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
