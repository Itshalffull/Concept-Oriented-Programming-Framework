// generated: flaky_test/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::FlakyTestHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn flaky_test_invariant_1() {
        // invariant 1: after record, record, record, isQuarantined behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let f = "u-test-invariant-001".to_string();
        let r = "u-test-invariant-002".to_string();
        let o = "u-test-invariant-003".to_string();
        let t = "u-test-invariant-004".to_string();

        // --- AFTER clause ---
        // record(testId: "test_timing", language: "typescript", builder: "TypeScriptBuilder", testType: "unit", passed: true, duration: 50) -> ok(test: f)
        let step1 = handler.record(
            RecordInput { test_id: "test_timing".to_string(), language: "typescript".to_string(), builder: "TypeScriptBuilder".to_string(), test_type: "unit".to_string(), passed: true, duration: 50 },
            &storage,
        ).await.unwrap();
        match step1 {
            RecordOutput::Ok { test, .. } => {
                assert_eq!(test, f.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
        // record(testId: "test_timing", language: "typescript", builder: "TypeScriptBuilder", testType: "unit", passed: false, duration: 5001) -> ok(test: f)
        let step2 = handler.record(
            RecordInput { test_id: "test_timing".to_string(), language: "typescript".to_string(), builder: "TypeScriptBuilder".to_string(), test_type: "unit".to_string(), passed: false, duration: 5001 },
            &storage,
        ).await.unwrap();
        match step2 {
            RecordOutput::Ok { test, .. } => {
                assert_eq!(test, f.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
        // record(testId: "test_timing", language: "typescript", builder: "TypeScriptBuilder", testType: "unit", passed: true, duration: 48) -> ok(test: f)
        let step3 = handler.record(
            RecordInput { test_id: "test_timing".to_string(), language: "typescript".to_string(), builder: "TypeScriptBuilder".to_string(), test_type: "unit".to_string(), passed: true, duration: 48 },
            &storage,
        ).await.unwrap();
        match step3 {
            RecordOutput::Ok { test, .. } => {
                assert_eq!(test, f.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // isQuarantined(testId: "test_timing") -> yes(test: f, reason: r, owner: o, quarantinedAt: t)
        let step4 = handler.is_quarantined(
            IsQuarantinedInput { test_id: "test_timing".to_string() },
            &storage,
        ).await.unwrap();
        match step4 {
            IsQuarantinedOutput::Yes { test, reason, owner, quarantined_at, .. } => {
                assert_eq!(test, f.clone());
                assert_eq!(reason, r.clone());
                assert_eq!(owner, o.clone());
                assert_eq!(quarantined_at, t.clone());
            },
            other => panic!("Expected Yes, got {:?}", other),
        }
    }

}
