// generated: conformance/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::ConformanceHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn conformance_invariant_1() {
        // invariant 1: after generate, verify, matrix behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let c = "u-test-invariant-001".to_string();
        let vs = "u-test-invariant-002".to_string();
        let reqs = "u-test-invariant-003".to_string();
        let m = "u-test-invariant-004".to_string();

        // --- AFTER clause ---
        // generate(concept: "password", specPath: "./specs/password.concept") -> ok(suite: c, testVectors: vs)
        let step1 = handler.generate(
            GenerateInput { concept: "password".to_string(), spec_path: "./specs/password.concept".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            GenerateOutput::Ok { suite, test_vectors, .. } => {
                assert_eq!(suite, c.clone());
                assert_eq!(test_vectors, vs.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
        // verify(suite: c, language: "typescript", artifactLocation: ".clef-artifacts/ts/password") -> ok(passed: 12, total: 12, coveredRequirements: reqs)
        let step2 = handler.verify(
            VerifyInput { suite: c.clone(), language: "typescript".to_string(), artifact_location: ".clef-artifacts/ts/password".to_string() },
            &storage,
        ).await.unwrap();
        match step2 {
            VerifyOutput::Ok { passed, total, covered_requirements, .. } => {
                assert_eq!(passed, 12);
                assert_eq!(total, 12);
                assert_eq!(covered_requirements, reqs.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // matrix(concepts: ["password"]) -> ok(matrix: m)
        let step3 = handler.matrix(
            MatrixInput { concepts: todo!(/* list: ["password".to_string()] */) },
            &storage,
        ).await.unwrap();
        match step3 {
            MatrixOutput::Ok { matrix, .. } => {
                assert_eq!(matrix, m.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
