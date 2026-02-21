// generated: queue/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::QueueHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn queue_invariant_1() {
        // invariant 1: after enqueue, claim, process behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let q = "u-test-invariant-001".to_string();

        // --- AFTER clause ---
        // enqueue(queue: q, item: "send_email", priority: 1) -> ok(itemId: "item-1")
        let step1 = handler.enqueue(
            EnqueueInput { queue: q.clone(), item: "send_email".to_string(), priority: 1 },
            &storage,
        ).await.unwrap();
        match step1 {
            EnqueueOutput::Ok { item_id, .. } => {
                assert_eq!(item_id, "item-1".to_string());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // claim(queue: q, worker: "worker-a") -> ok(item: "send_email")
        let step2 = handler.claim(
            ClaimInput { queue: q.clone(), worker: "worker-a".to_string() },
            &storage,
        ).await.unwrap();
        match step2 {
            ClaimOutput::Ok { item, .. } => {
                assert_eq!(item, "send_email".to_string());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
        // process(queue: q, itemId: "item-1", result: "sent") -> ok()
        let step3 = handler.process(
            ProcessInput { queue: q.clone(), item_id: "item-1".to_string(), result: "sent".to_string() },
            &storage,
        ).await.unwrap();
        assert!(matches!(step3, ProcessOutput::Ok));
    }

}
