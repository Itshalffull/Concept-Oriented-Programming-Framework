// generated: capture/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::CaptureHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn capture_invariant_1() {
        // invariant 1: after clip, markReady behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        // --- AFTER clause ---
        // clip(url: "https://example.com/article", mode: "web_article", metadata: "{}") -> ok(itemId: "cap-1", content: "article text")
        let step1 = handler.clip(
            ClipInput { url: "https://example.com/article".to_string(), mode: "web_article".to_string(), metadata: "{}".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            ClipOutput::Ok { item_id, content, .. } => {
                assert_eq!(item_id, "cap-1".to_string());
                assert_eq!(content, "article text".to_string());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // markReady(itemId: "cap-1") -> ok()
        let step2 = handler.mark_ready(
            MarkReadyInput { item_id: "cap-1".to_string() },
            &storage,
        ).await.unwrap();
        assert!(matches!(step2, MarkReadyOutput::Ok));
    }

    #[tokio::test]
    async fn capture_invariant_2() {
        // invariant 2: after subscribe, detectChanges behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        // --- AFTER clause ---
        // subscribe(sourceId: "src-1", schedule: "*/30 * * * *", mode: "api_poll") -> ok(subscriptionId: "sub-1")
        let step1 = handler.subscribe(
            SubscribeInput { source_id: "src-1".to_string(), schedule: "*/30 * * * *".to_string(), mode: "api_poll".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            SubscribeOutput::Ok { subscription_id, .. } => {
                assert_eq!(subscription_id, "sub-1".to_string());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // detectChanges(subscriptionId: "sub-1") -> ok(changeset: "[\"item-1\",\"item-2\"]")
        let step2 = handler.detect_changes(
            DetectChangesInput { subscription_id: "sub-1".to_string() },
            &storage,
        ).await.unwrap();
        match step2 {
            DetectChangesOutput::Ok { changeset, .. } => {
                assert_eq!(changeset, "["item-1","item-2"]".to_string());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
