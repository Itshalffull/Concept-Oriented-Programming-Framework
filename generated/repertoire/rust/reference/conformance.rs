// generated: reference/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::ReferenceHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn reference_invariant_1() {
        // invariant 1: after addRef, getRefs behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let x = "u-test-invariant-001".to_string();

        // --- AFTER clause ---
        // addRef(source: x, target: "doc-1") -> ok(source: x, target: "doc-1")
        let step1 = handler.add_ref(
            AddRefInput { source: x.clone(), target: "doc-1".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            AddRefOutput::Ok { source, target, .. } => {
                assert_eq!(source, x.clone());
                assert_eq!(target, "doc-1".to_string());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // getRefs(source: x) -> ok(targets: "doc-1")
        let step2 = handler.get_refs(
            GetRefsInput { source: x.clone() },
            &storage,
        ).await.unwrap();
        match step2 {
            GetRefsOutput::Ok { targets, .. } => {
                assert_eq!(targets, "doc-1".to_string());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
