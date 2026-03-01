// generated: semantic_embedding/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::SemanticEmbeddingHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn semantic_embedding_invariant_1() {
        // invariant 1: after compute, get behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let b = "u-test-invariant-001".to_string();

        // --- AFTER clause ---
        // compute(unit: "def-123", model: "codeBERT") -> ok(embedding: b)
        let step1 = handler.compute(
            ComputeInput { unit: "def-123".to_string(), model: "codeBERT".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            ComputeOutput::Ok { embedding, .. } => {
                assert_eq!(embedding, b.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // get(embedding: b) -> ok(embedding: b, unit: "def-123", model: "codeBERT", dimensions: _)
        let step2 = handler.get(
            GetInput { embedding: b.clone() },
            &storage,
        ).await.unwrap();
        match step2 {
            GetOutput::Ok { embedding, unit, model, dimensions, .. } => {
                assert_eq!(embedding, b.clone());
                assert_eq!(unit, "def-123".to_string());
                assert_eq!(model, "codeBERT".to_string());
                assert_eq!(dimensions, .clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
