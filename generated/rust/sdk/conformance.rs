// generated: sdk/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::SdkHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn sdk_invariant_1() {
        // invariant 1: after generate, publish behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let s = "u-test-invariant-001".to_string();
        let f = "u-test-invariant-002".to_string();
        let p = "u-test-invariant-003".to_string();

        // --- AFTER clause ---
        // generate(projection: "test-projection", language: "typescript", config: "{}") -> ok(package: s, files: f, packageJson: p)
        let step1 = handler.generate(
            GenerateInput { projection: "test-projection".to_string(), language: "typescript".to_string(), config: "{}".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            GenerateOutput::Ok { package, files, package_json, .. } => {
                assert_eq!(package, s.clone());
                assert_eq!(files, f.clone());
                assert_eq!(package_json, p.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // publish(package: s, registry: "npm") -> ok(package: s, publishedVersion: "1.0.0")
        let step2 = handler.publish(
            PublishInput { package: s.clone(), registry: "npm".to_string() },
            &storage,
        ).await.unwrap();
        match step2 {
            PublishOutput::Ok { package, published_version, .. } => {
                assert_eq!(package, s.clone());
                assert_eq!(published_version, "1.0.0".to_string());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
