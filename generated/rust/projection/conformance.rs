// generated: projection/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::ProjectionHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn projection_invariant_1() {
        // invariant 1: after project, validate, inferResources behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let p = "u-test-invariant-001".to_string();
        let w = "u-test-invariant-002".to_string();
        let r = "u-test-invariant-003".to_string();

        // --- AFTER clause ---
        // project(manifest: "valid-manifest", annotations: "valid-annotations") -> ok(projection: p, shapes: 3, actions: 4, traits: 2)
        let step1 = handler.project(
            ProjectInput { manifest: "valid-manifest".to_string(), annotations: "valid-annotations".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            ProjectOutput::Ok { projection, shapes, actions, traits, .. } => {
                assert_eq!(projection, p.clone());
                assert_eq!(shapes, 3);
                assert_eq!(actions, 4);
                assert_eq!(traits, 2);
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // validate(projection: p) -> ok(projection: p, warnings: w)
        let step2 = handler.validate(
            ValidateInput { projection: p.clone() },
            &storage,
        ).await.unwrap();
        match step2 {
            ValidateOutput::Ok { projection, warnings, .. } => {
                assert_eq!(projection, p.clone());
                assert_eq!(warnings, w.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
        // inferResources(projection: p) -> ok(projection: p, resources: r)
        let step3 = handler.infer_resources(
            InferResourcesInput { projection: p.clone() },
            &storage,
        ).await.unwrap();
        match step3 {
            InferResourcesOutput::Ok { projection, resources, .. } => {
                assert_eq!(projection, p.clone());
                assert_eq!(resources, r.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
