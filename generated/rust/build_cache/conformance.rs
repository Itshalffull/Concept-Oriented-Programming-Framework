// generated: build_cache/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::BuildCacheHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn build_cache_invariant_1() {
        // invariant 1: after record, check, check behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let e = "u-test-invariant-001".to_string();
        let t = "u-test-invariant-002".to_string();

        // --- AFTER clause ---
        // record(stepKey: "framework:TypeScriptGen:password", inputHash: "abc", outputHash: "xyz", outputRef: ".clef-cache/ts/password", sourceLocator: "./specs/password.concept", deterministic: true) -> ok(entry: e)
        let step1 = handler.record(
            RecordInput { step_key: "framework:TypeScriptGen:password".to_string(), input_hash: "abc".to_string(), output_hash: "xyz".to_string(), output_ref: ".clef-cache/ts/password".to_string(), source_locator: "./specs/password.concept".to_string(), deterministic: true },
            &storage,
        ).await.unwrap();
        match step1 {
            RecordOutput::Ok { entry, .. } => {
                assert_eq!(entry, e.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // check(stepKey: "framework:TypeScriptGen:password", inputHash: "abc", deterministic: true) -> unchanged(lastRun: t, outputRef: ".clef-cache/ts/password")
        let step2 = handler.check(
            CheckInput { step_key: "framework:TypeScriptGen:password".to_string(), input_hash: "abc".to_string(), deterministic: true },
            &storage,
        ).await.unwrap();
        match step2 {
            CheckOutput::Unchanged { last_run, output_ref, .. } => {
                assert_eq!(last_run, t.clone());
                assert_eq!(output_ref, ".clef-cache/ts/password".to_string());
            },
            other => panic!("Expected Unchanged, got {:?}", other),
        }
        // check(stepKey: "framework:TypeScriptGen:password", inputHash: "def", deterministic: true) -> changed(previousHash: "abc")
        let step3 = handler.check(
            CheckInput { step_key: "framework:TypeScriptGen:password".to_string(), input_hash: "def".to_string(), deterministic: true },
            &storage,
        ).await.unwrap();
        match step3 {
            CheckOutput::Changed { previous_hash, .. } => {
                assert_eq!(previous_hash, "abc".to_string());
            },
            other => panic!("Expected Changed, got {:?}", other),
        }
    }

    #[tokio::test]
    async fn build_cache_invariant_2() {
        // invariant 2: after invalidate, check behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        // --- AFTER clause ---
        // invalidate(stepKey: "framework:TypeScriptGen:password") -> ok()
        let step1 = handler.invalidate(
            InvalidateInput { step_key: "framework:TypeScriptGen:password".to_string() },
            &storage,
        ).await.unwrap();
        assert!(matches!(step1, InvalidateOutput::Ok));

        // --- THEN clause ---
        // check(stepKey: "framework:TypeScriptGen:password", inputHash: "abc", deterministic: true) -> changed(previousHash: "abc")
        let step2 = handler.check(
            CheckInput { step_key: "framework:TypeScriptGen:password".to_string(), input_hash: "abc".to_string(), deterministic: true },
            &storage,
        ).await.unwrap();
        match step2 {
            CheckOutput::Changed { previous_hash, .. } => {
                assert_eq!(previous_hash, "abc".to_string());
            },
            other => panic!("Expected Changed, got {:?}", other),
        }
    }

}
