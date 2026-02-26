// generated: event_bus/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::EventBusHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn event_bus_invariant_1() {
        // invariant 1: after registerEventType, subscribe, dispatch behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let sid = "u-test-invariant-001".to_string();
        let e = "u-test-invariant-002".to_string();
        let r = "u-test-invariant-003".to_string();

        // --- AFTER clause ---
        // registerEventType(name: "user.login", schema: "{}") -> ok()
        let step1 = handler.register_event_type(
            RegisterEventTypeInput { name: "user.login".to_string(), schema: "{}".to_string() },
            &storage,
        ).await.unwrap();
        assert!(matches!(step1, RegisterEventTypeOutput::Ok));

        // --- THEN clause ---
        // subscribe(event: "user.login", handler: "logHandler", priority: 10) -> ok(subscriptionId: sid)
        let step2 = handler.subscribe(
            SubscribeInput { event: "user.login".to_string(), handler: "logHandler".to_string(), priority: 10 },
            &storage,
        ).await.unwrap();
        match step2 {
            SubscribeOutput::Ok { subscription_id, .. } => {
                assert_eq!(subscription_id, sid.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
        // dispatch(event: e, data: "{\"user\":\"alice\"}") -> ok(results: r)
        let step3 = handler.dispatch(
            DispatchInput { event: e.clone(), data: "{"user":"alice"}".to_string() },
            &storage,
        ).await.unwrap();
        match step3 {
            DispatchOutput::Ok { results, .. } => {
                assert_eq!(results, r.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
