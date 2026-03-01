// generated: retention_policy/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::RetentionPolicyHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn retention_policy_invariant_1() {
        // invariant 1: after applyHold, dispose behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let h = "u-test-invariant-001".to_string();

        // --- AFTER clause ---
        // applyHold(name: "litigation-2024", scope: "matter:123/*", reason: "pending case", issuer: "legal") -> ok(holdId: h)
        let step1 = handler.apply_hold(
            ApplyHoldInput { name: "litigation-2024".to_string(), scope: "matter:123/*".to_string(), reason: "pending case".to_string(), issuer: "legal".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            ApplyHoldOutput::Ok { hold_id, .. } => {
                assert_eq!(hold_id, h.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // dispose(record: "matter:123/doc-1", disposedBy: "system") -> held(holdNames: ["litigation-2024"])
        let step2 = handler.dispose(
            DisposeInput { record: "matter:123/doc-1".to_string(), disposed_by: "system".to_string() },
            &storage,
        ).await.unwrap();
        match step2 {
            DisposeOutput::Held { hold_names, .. } => {
                assert_eq!(hold_names, todo!(/* list: ["litigation-2024".to_string()] */));
            },
            other => panic!("Expected Held, got {:?}", other),
        }
    }

    #[tokio::test]
    async fn retention_policy_invariant_2() {
        // invariant 2: after setRetention, checkDisposition behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let p = "u-test-invariant-001".to_string();

        // --- AFTER clause ---
        // setRetention(recordType: "audit", period: 7, unit: "years", dispositionAction: "archive") -> ok(policyId: p)
        let step1 = handler.set_retention(
            SetRetentionInput { record_type: "audit".to_string(), period: 7, unit: "years".to_string(), disposition_action: "archive".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            SetRetentionOutput::Ok { policy_id, .. } => {
                assert_eq!(policy_id, p.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // checkDisposition(record: "audit:recent") -> retained(reason: _, until: _)
        let step2 = handler.check_disposition(
            CheckDispositionInput { record: "audit:recent".to_string() },
            &storage,
        ).await.unwrap();
        match step2 {
            CheckDispositionOutput::Retained { reason, until, .. } => {
                assert_eq!(reason, .clone());
                assert_eq!(until, .clone());
            },
            other => panic!("Expected Retained, got {:?}", other),
        }
    }

}
