// generated: notification/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::NotificationHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn notification_invariant_1() {
        // invariant 1: after registerChannel, defineTemplate, subscribe, notify, getUnread behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let c = "u-test-invariant-001".to_string();
        let cfg = "u-test-invariant-002".to_string();
        let n = "u-test-invariant-003".to_string();
        let t = "u-test-invariant-004".to_string();
        let u = "u-test-invariant-005".to_string();
        let e = "u-test-invariant-006".to_string();
        let d = "u-test-invariant-007".to_string();

        // --- AFTER clause ---
        // registerChannel(name: c, config: cfg) -> ok()
        let step1 = handler.register_channel(
            RegisterChannelInput { name: c.clone(), config: cfg.clone() },
            &storage,
        ).await.unwrap();
        assert!(matches!(step1, RegisterChannelOutput::Ok));

        // --- THEN clause ---
        // defineTemplate(notification: n, template: t) -> ok()
        let step2 = handler.define_template(
            DefineTemplateInput { notification: n.clone(), template: t.clone() },
            &storage,
        ).await.unwrap();
        assert!(matches!(step2, DefineTemplateOutput::Ok));
        // subscribe(user: u, eventType: e, channel: c) -> ok()
        let step3 = handler.subscribe(
            SubscribeInput { user: u.clone(), event_type: e.clone(), channel: c.clone() },
            &storage,
        ).await.unwrap();
        assert!(matches!(step3, SubscribeOutput::Ok));
        // notify(notification: n, user: u, template: t, data: d) -> ok()
        let step4 = handler.notify(
            NotifyInput { notification: n.clone(), user: u.clone(), template: t.clone(), data: d.clone() },
            &storage,
        ).await.unwrap();
        assert!(matches!(step4, NotifyOutput::Ok));
        // getUnread(user: u) -> ok(notifications: n)
        let step5 = handler.get_unread(
            GetUnreadInput { user: u.clone() },
            &storage,
        ).await.unwrap();
        match step5 {
            GetUnreadOutput::Ok { notifications, .. } => {
                assert_eq!(notifications, n.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

    #[tokio::test]
    async fn notification_invariant_2() {
        // invariant 2: after notify, markRead, getUnread behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let n = "u-test-invariant-001".to_string();
        let u = "u-test-invariant-002".to_string();
        let t = "u-test-invariant-003".to_string();
        let d = "u-test-invariant-004".to_string();

        // --- AFTER clause ---
        // notify(notification: n, user: u, template: t, data: d) -> ok()
        let step1 = handler.notify(
            NotifyInput { notification: n.clone(), user: u.clone(), template: t.clone(), data: d.clone() },
            &storage,
        ).await.unwrap();
        assert!(matches!(step1, NotifyOutput::Ok));

        // --- THEN clause ---
        // markRead(notification: n) -> ok()
        let step2 = handler.mark_read(
            MarkReadInput { notification: n.clone() },
            &storage,
        ).await.unwrap();
        assert!(matches!(step2, MarkReadOutput::Ok));
        // getUnread(user: u) -> ok(notifications: _)
        let step3 = handler.get_unread(
            GetUnreadInput { user: u.clone() },
            &storage,
        ).await.unwrap();
        match step3 {
            GetUnreadOutput::Ok { notifications, .. } => {
                assert_eq!(notifications, .clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
