// generated: contract/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::ContractHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn contract_invariant_1() {
        // invariant 1: after define, verify behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let c = "u-test-invariant-001".to_string();

        // --- AFTER clause ---
        // define(name: "user-password-contract", source_concept: "clef/concept/User", target_concept: "clef/concept/Password", assumptions: ["user-exists-before-password"], guarantees: ["password-hash-nonzero"]) -> ok(contract: c)
        let step1 = handler.define(
            DefineInput { name: "user-password-contract".to_string(), source_concept: "clef/concept/User".to_string(), target_concept: "clef/concept/Password".to_string(), assumptions: todo!(/* list: ["user-exists-before-password".to_string()] */), guarantees: todo!(/* list: ["password-hash-nonzero".to_string()] */) },
            &storage,
        ).await.unwrap();
        match step1 {
            DefineOutput::Ok { contract, .. } => {
                assert_eq!(contract, c.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // verify(contract: c) -> ok(contract: c, compatible: true)
        let step2 = handler.verify(
            VerifyInput { contract: c.clone() },
            &storage,
        ).await.unwrap();
        match step2 {
            VerifyOutput::Ok { contract, compatible, .. } => {
                assert_eq!(contract, c.clone());
                assert_eq!(compatible, true);
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}