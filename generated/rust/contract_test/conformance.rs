// generated: contract_test/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::ContractTestHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn contract_test_invariant_1() {
        // invariant 1: after generate, verify, canDeploy behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let p = "u-test-invariant-001".to_string();
        let d = "u-test-invariant-002".to_string();

        // --- AFTER clause ---
        // generate(concept: "password", specPath: "./specs/password.concept") -> ok(contract: p, definition: d)
        let step1 = handler.generate(
            GenerateInput { concept: "password".to_string(), spec_path: "./specs/password.concept".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            GenerateOutput::Ok { contract, definition, .. } => {
                assert_eq!(contract, p.clone());
                assert_eq!(definition, d.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
        // verify(contract: p, producerArtifact: ".clef-artifacts/rust/password", producerLanguage: "rust", consumerArtifact: ".clef-artifacts/ts/password", consumerLanguage: "typescript") -> ok(contract: p, passed: 8, total: 8)
        let step2 = handler.verify(
            VerifyInput { contract: p.clone(), producer_artifact: ".clef-artifacts/rust/password".to_string(), producer_language: "rust".to_string(), consumer_artifact: ".clef-artifacts/ts/password".to_string(), consumer_language: "typescript".to_string() },
            &storage,
        ).await.unwrap();
        match step2 {
            VerifyOutput::Ok { contract, passed, total, .. } => {
                assert_eq!(contract, p.clone());
                assert_eq!(passed, 8);
                assert_eq!(total, 8);
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // canDeploy(concept: "password", language: "typescript") -> ok(safe: true, verifiedAgainst: ["rust"])
        let step3 = handler.can_deploy(
            CanDeployInput { concept: "password".to_string(), language: "typescript".to_string() },
            &storage,
        ).await.unwrap();
        match step3 {
            CanDeployOutput::Ok { safe, verified_against, .. } => {
                assert_eq!(safe, true);
                assert_eq!(verified_against, todo!(/* list: ["rust".to_string()] */));
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
