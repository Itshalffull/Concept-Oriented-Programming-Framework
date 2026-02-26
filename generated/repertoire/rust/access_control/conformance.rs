// generated: access_control/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::AccessControlHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn access_control_invariant_1() {
        // invariant 1: after check, check, andIf behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let t = "u-test-invariant-001".to_string();
        let t2 = "u-test-invariant-002".to_string();

        // --- AFTER clause ---
        // check(resource: "document:123", action: "read", context: "user:alice") -> ok(result: "allowed", tags: t, maxAge: 300)
        let step1 = handler.check(
            CheckInput { resource: "document:123".to_string(), action: "read".to_string(), context: "user:alice".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            CheckOutput::Ok { result, tags, max_age, .. } => {
                assert_eq!(result, "allowed".to_string());
                assert_eq!(tags, t.clone());
                assert_eq!(max_age, 300);
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
        // check(resource: "document:123", action: "delete", context: "user:alice") -> ok(result: "forbidden", tags: t2, maxAge: 60)
        let step2 = handler.check(
            CheckInput { resource: "document:123".to_string(), action: "delete".to_string(), context: "user:alice".to_string() },
            &storage,
        ).await.unwrap();
        match step2 {
            CheckOutput::Ok { result, tags, max_age, .. } => {
                assert_eq!(result, "forbidden".to_string());
                assert_eq!(tags, t2.clone());
                assert_eq!(max_age, 60);
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // andIf(left: "allowed", right: "forbidden") -> ok(result: "forbidden")
        let step3 = handler.and_if(
            AndIfInput { left: "allowed".to_string(), right: "forbidden".to_string() },
            &storage,
        ).await.unwrap();
        match step3 {
            AndIfOutput::Ok { result, .. } => {
                assert_eq!(result, "forbidden".to_string());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

    #[tokio::test]
    async fn access_control_invariant_2() {
        // invariant 2: after orIf, andIf behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        // --- AFTER clause ---
        // orIf(left: "neutral", right: "allowed") -> ok(result: "allowed")
        let step1 = handler.or_if(
            OrIfInput { left: "neutral".to_string(), right: "allowed".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            OrIfOutput::Ok { result, .. } => {
                assert_eq!(result, "allowed".to_string());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // andIf(left: "allowed", right: "allowed") -> ok(result: "allowed")
        let step2 = handler.and_if(
            AndIfInput { left: "allowed".to_string(), right: "allowed".to_string() },
            &storage,
        ).await.unwrap();
        match step2 {
            AndIfOutput::Ok { result, .. } => {
                assert_eq!(result, "allowed".to_string());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

    #[tokio::test]
    async fn access_control_invariant_3() {
        // invariant 3: after orIf, andIf behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        // --- AFTER clause ---
        // orIf(left: "neutral", right: "neutral") -> ok(result: "neutral")
        let step1 = handler.or_if(
            OrIfInput { left: "neutral".to_string(), right: "neutral".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            OrIfOutput::Ok { result, .. } => {
                assert_eq!(result, "neutral".to_string());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // andIf(left: "neutral", right: "neutral") -> ok(result: "neutral")
        let step2 = handler.and_if(
            AndIfInput { left: "neutral".to_string(), right: "neutral".to_string() },
            &storage,
        ).await.unwrap();
        match step2 {
            AndIfOutput::Ok { result, .. } => {
                assert_eq!(result, "neutral".to_string());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
