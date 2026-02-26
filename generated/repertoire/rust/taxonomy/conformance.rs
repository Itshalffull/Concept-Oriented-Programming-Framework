// generated: taxonomy/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::TaxonomyHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn taxonomy_invariant_1() {
        // invariant 1: after createVocabulary, addTerm, tagEntity, untagEntity behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let v = "u-test-invariant-001".to_string();
        let none = "u-test-invariant-002".to_string();

        // --- AFTER clause ---
        // createVocabulary(vocab: v, name: "topics") -> ok()
        let step1 = handler.create_vocabulary(
            CreateVocabularyInput { vocab: v.clone(), name: "topics".to_string() },
            &storage,
        ).await.unwrap();
        assert!(matches!(step1, CreateVocabularyOutput::Ok));

        // --- THEN clause ---
        // addTerm(vocab: v, term: "science", parent: none) -> ok()
        let step2 = handler.add_term(
            AddTermInput { vocab: v.clone(), term: "science".to_string(), parent: none.clone() },
            &storage,
        ).await.unwrap();
        assert!(matches!(step2, AddTermOutput::Ok));
        // tagEntity(entity: "page-1", vocab: v, term: "science") -> ok()
        let step3 = handler.tag_entity(
            TagEntityInput { entity: "page-1".to_string(), vocab: v.clone(), term: "science".to_string() },
            &storage,
        ).await.unwrap();
        assert!(matches!(step3, TagEntityOutput::Ok));
        // untagEntity(entity: "page-1", vocab: v, term: "science") -> ok()
        let step4 = handler.untag_entity(
            UntagEntityInput { entity: "page-1".to_string(), vocab: v.clone(), term: "science".to_string() },
            &storage,
        ).await.unwrap();
        assert!(matches!(step4, UntagEntityOutput::Ok));
    }

}
