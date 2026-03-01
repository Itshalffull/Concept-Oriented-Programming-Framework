// generated: field_mapping/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::FieldMappingHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn field_mapping_invariant_1() {
        // invariant 1: after autoDiscover, map, apply behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        // --- AFTER clause ---
        // autoDiscover(sourceSchema: "external_post", destSchema: "Article") -> ok(mappingId: "map-1", suggestions: "[{\"src\":\"title\",\"dest\":\"title\"}]")
        let step1 = handler.auto_discover(
            AutoDiscoverInput { source_schema: "external_post".to_string(), dest_schema: "Article".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            AutoDiscoverOutput::Ok { mapping_id, suggestions, .. } => {
                assert_eq!(mapping_id, "map-1".to_string());
                assert_eq!(suggestions, "[{"src":"title","dest":"title"}]".to_string());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // map(mappingId: "map-1", sourceField: "body_html", destField: "body", transform: "html_to_markdown") -> ok()
        let step2 = handler.map(
            MapInput { mapping_id: "map-1".to_string(), source_field: "body_html".to_string(), dest_field: "body".to_string(), transform: "html_to_markdown".to_string() },
            &storage,
        ).await.unwrap();
        assert!(matches!(step2, MapOutput::Ok));
        // apply(record: "{\"title\":\"Hello\",\"body_html\":\"<p>World</p>\"}", mappingId: "map-1") -> ok(mapped: "{\"title\":\"Hello\",\"body\":\"World\"}")
        let step3 = handler.apply(
            ApplyInput { record: "{"title":"Hello","body_html":"<p>World</p>"}".to_string(), mapping_id: "map-1".to_string() },
            &storage,
        ).await.unwrap();
        match step3 {
            ApplyOutput::Ok { mapped, .. } => {
                assert_eq!(mapped, "{"title":"Hello","body":"World"}".to_string());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
