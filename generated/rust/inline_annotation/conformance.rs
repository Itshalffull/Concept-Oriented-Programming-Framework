// generated: inline_annotation/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::InlineAnnotationHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn inline_annotation_invariant_1() {
        // invariant 1: after annotate, accept behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let c = "u-test-invariant-001".to_string();
        let s = "u-test-invariant-002".to_string();
        let a = "u-test-invariant-003".to_string();
        let id = "u-test-invariant-004".to_string();

        // --- AFTER clause ---
        // annotate(contentRef: c, changeType: "insertion", scope: s, author: a) -> ok(annotationId: id)
        let step1 = handler.annotate(
            AnnotateInput { content_ref: c.clone(), change_type: "insertion".to_string(), scope: s.clone(), author: a.clone() },
            &storage,
        ).await.unwrap();
        match step1 {
            AnnotateOutput::Ok { annotation_id, .. } => {
                assert_eq!(annotation_id, id.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // accept(annotationId: id) -> ok(cleanContent: _)
        let step2 = handler.accept(
            AcceptInput { annotation_id: id.clone() },
            &storage,
        ).await.unwrap();
        match step2 {
            AcceptOutput::Ok { clean_content, .. } => {
                assert_eq!(clean_content, .clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

    #[tokio::test]
    async fn inline_annotation_invariant_2() {
        // invariant 2: after toggleTracking, annotate behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let c = "u-test-invariant-001".to_string();

        // --- AFTER clause ---
        // toggleTracking(contentRef: c, enabled: false) -> ok()
        let step1 = handler.toggle_tracking(
            ToggleTrackingInput { content_ref: c.clone(), enabled: false },
            &storage,
        ).await.unwrap();
        assert!(matches!(step1, ToggleTrackingOutput::Ok));

        // --- THEN clause ---
        // annotate(contentRef: c, changeType: "insertion", scope: _, author: _) -> trackingDisabled(message: _)
        let step2 = handler.annotate(
            AnnotateInput { content_ref: c.clone(), change_type: "insertion".to_string(), scope: .clone(), author: .clone() },
            &storage,
        ).await.unwrap();
        match step2 {
            AnnotateOutput::TrackingDisabled { message, .. } => {
                assert_eq!(message, .clone());
            },
            other => panic!("Expected TrackingDisabled, got {:?}", other),
        }
    }

}
