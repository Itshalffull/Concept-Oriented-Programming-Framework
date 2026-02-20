// generated: deployment_validator/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::DeploymentValidatorHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn deployment_validator_invariant_1() {
        // invariant 1: after parse, validate behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let m = "u-test-invariant-001".to_string();
        let i = "u-test-invariant-002".to_string();

        // --- AFTER clause ---
        // parse(raw: "{\"app\":{\"name\":\"myapp\",\"version\":\"1.0\",\"uri\":\"urn:app/myapp\"},\"runtimes\":{},\"concepts\":{},\"syncs\":[]}") -> ok(manifest: m)
        let step1 = handler.parse(
            ParseInput { raw: "{"app":{"name":"myapp","version":"1.0","uri":"urn:app/myapp"},"runtimes":{},"concepts":{},"syncs":[]}".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            ParseOutput::Ok { manifest, .. } => {
                assert_eq!(manifest, m.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // validate(manifest: m) -> error(issues: i)
        let step2 = handler.validate(
            ValidateInput { manifest: m.clone() },
            &storage,
        ).await.unwrap();
        match step2 {
            ValidateOutput::Error { issues, .. } => {
                assert_eq!(issues, i.clone());
            },
            other => panic!("Expected Error, got {:?}", other),
        }
    }

    #[tokio::test]
    async fn deployment_validator_invariant_2() {
        // invariant 2: after parse, parse behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let m = "u-test-invariant-001".to_string();
        let e = "u-test-invariant-002".to_string();

        // --- AFTER clause ---
        // parse(raw: "{\"app\":{\"name\":\"t\",\"version\":\"1\",\"uri\":\"u\"},\"runtimes\":{},\"concepts\":{},\"syncs\":[]}") -> ok(manifest: m)
        let step1 = handler.parse(
            ParseInput { raw: "{"app":{"name":"t","version":"1","uri":"u"},"runtimes":{},"concepts":{},"syncs":[]}".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            ParseOutput::Ok { manifest, .. } => {
                assert_eq!(manifest, m.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // parse(raw: "not json") -> error(message: e)
        let step2 = handler.parse(
            ParseInput { raw: "not json".to_string() },
            &storage,
        ).await.unwrap();
        match step2 {
            ParseOutput::Error { message, .. } => {
                assert_eq!(message, e.clone());
            },
            other => panic!("Expected Error, got {:?}", other),
        }
    }

}
