// generated: spec/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::SpecHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn spec_invariant_1() {
        // invariant 1: after emit, validate behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let d = "u-test-invariant-001".to_string();
        let c = "u-test-invariant-002".to_string();

        // --- AFTER clause ---
        // emit(projections: ["proj-1"], format: "openapi", config: "{}") -> ok(document: d, content: c)
        let step1 = handler.emit(
            EmitInput { projections: todo!(/* list: ["proj-1".to_string()] */), format: "openapi".to_string(), config: "{}".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            EmitOutput::Ok { document, content, .. } => {
                assert_eq!(document, d.clone());
                assert_eq!(content, c.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // validate(document: d) -> ok(document: d)
        let step2 = handler.validate(
            ValidateInput { document: d.clone() },
            &storage,
        ).await.unwrap();
        match step2 {
            ValidateOutput::Ok { document, .. } => {
                assert_eq!(document, d.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
