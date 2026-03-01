// generated: attribution/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::AttributionHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn attribution_invariant_1() {
        // invariant 1: after attribute, blame behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let c = "u-test-invariant-001".to_string();
        let r = "u-test-invariant-002".to_string();
        let a = "u-test-invariant-003".to_string();
        let ch = "u-test-invariant-004".to_string();
        let id = "u-test-invariant-005".to_string();
        let m = "u-test-invariant-006".to_string();

        // --- AFTER clause ---
        // attribute(contentRef: c, region: r, agent: a, changeRef: ch) -> ok(attributionId: id)
        let step1 = handler.attribute(
            AttributeInput { content_ref: c.clone(), region: r.clone(), agent: a.clone(), change_ref: ch.clone() },
            &storage,
        ).await.unwrap();
        match step1 {
            AttributeOutput::Ok { attribution_id, .. } => {
                assert_eq!(attribution_id, id.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // blame(contentRef: c) -> ok(map: m)
        let step2 = handler.blame(
            BlameInput { content_ref: c.clone() },
            &storage,
        ).await.unwrap();
        match step2 {
            BlameOutput::Ok { map, .. } => {
                assert_eq!(map, m.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
