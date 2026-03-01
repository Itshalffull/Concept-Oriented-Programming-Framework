// generated: search_index/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::SearchIndexHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn search_index_invariant_1() {
        // invariant 1: after createIndex, indexItem, search behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let i = "u-test-invariant-001".to_string();
        let r = "u-test-invariant-002".to_string();

        // --- AFTER clause ---
        // createIndex(index: i, config: "{}") -> ok(index: i)
        let step1 = handler.create_index(
            CreateIndexInput { index: i.clone(), config: "{}".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            CreateIndexOutput::Ok { index, .. } => {
                assert_eq!(index, i.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // indexItem(index: i, item: "doc-1", data: "hello world") -> ok(index: i)
        let step2 = handler.index_item(
            IndexItemInput { index: i.clone(), item: "doc-1".to_string(), data: "hello world".to_string() },
            &storage,
        ).await.unwrap();
        match step2 {
            IndexItemOutput::Ok { index, .. } => {
                assert_eq!(index, i.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
        // search(index: i, query: "hello") -> ok(results: r)
        let step3 = handler.search(
            SearchInput { index: i.clone(), query: "hello".to_string() },
            &storage,
        ).await.unwrap();
        match step3 {
            SearchOutput::Ok { results, .. } => {
                assert_eq!(results, r.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
