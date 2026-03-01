// generated: wallet/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::WalletHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn wallet_invariant_1() {
        // invariant 1: after verify, verify behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let addr = "u-test-invariant-001".to_string();
        let msg = "u-test-invariant-002".to_string();
        let sig = "u-test-invariant-003".to_string();

        // --- AFTER clause ---
        // verify(address: addr, message: msg, signature: sig) -> ok(address: addr, recoveredAddress: addr)
        let step1 = handler.verify(
            VerifyInput { address: addr.clone(), message: msg.clone(), signature: sig.clone() },
            &storage,
        ).await.unwrap();
        match step1 {
            VerifyOutput::Ok { address, recovered_address, .. } => {
                assert_eq!(address, addr.clone());
                assert_eq!(recovered_address, addr.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // verify(address: addr, message: msg, signature: sig) -> ok(address: addr, recoveredAddress: addr)
        let step2 = handler.verify(
            VerifyInput { address: addr.clone(), message: msg.clone(), signature: sig.clone() },
            &storage,
        ).await.unwrap();
        match step2 {
            VerifyOutput::Ok { address, recovered_address, .. } => {
                assert_eq!(address, addr.clone());
                assert_eq!(recovered_address, addr.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
