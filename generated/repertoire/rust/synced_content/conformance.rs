// generated: synced_content/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::SyncedContentHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn synced_content_invariant_1() {
        // invariant 1: after createReference, editOriginal behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let r = "u-test-invariant-001".to_string();
        let o = "u-test-invariant-002".to_string();

        // --- AFTER clause ---
        // createReference(ref: r, original: o) -> ok()
        let step1 = handler.create_reference(
            CreateReferenceInput { ref: r.clone(), original: o.clone() },
            &storage,
        ).await.unwrap();
        assert!(matches!(step1, CreateReferenceOutput::Ok));

        // --- THEN clause ---
        // editOriginal(original: o, content: "updated") -> ok()
        let step2 = handler.edit_original(
            EditOriginalInput { original: o.clone(), content: "updated".to_string() },
            &storage,
        ).await.unwrap();
        assert!(matches!(step2, EditOriginalOutput::Ok));
    }

}
